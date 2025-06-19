package main

import (
	"encoding/json"
	"fmt"
	"github.com/go-playground/validator/v10"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
	"net/http"
	"time"
)

var validate = validator.New(validator.WithRequiredStructEnabled())

var InvalidInputErrorData = map[string]string{
	"error": "Invalid input data",
}
var UnexpectedErrorData = map[string]string{
	"error": "An unexpected error occurred",
}
var UnimplementedErrorData = map[string]string{
	"error": "This feature is not implemented yet",
}

type UserMessage struct {
	ParentMessageID string `json:"parentMessageId" validate:"omitempty,max=26,min=26"`
	Content         string `json:"content" validate:"required,max=50000"`
}

type NewUserMessageInput struct {
	UserMessage   UserMessage   `json:"userMessage" validate:"required"`
	ResponseModel ResponseModel `json:"responseModel" validate:"required"`
}

type NewThreadOutputThread struct {
	ID      string `json:"id"`
	Created string `json:"created"`
	Updated string `json:"updated"`
}

type NewThreadOutputThreadMessage struct {
	ID              string        `json:"id"`
	ParentThreadID  string        `json:"parentThreadId"`
	ParentMessageID string        `json:"parentMessageId,omitempty,omitzero"`
	Role            string        `json:"role"`
	Model           string        `json:"model"`
	Status          MessageStatus `json:"status"`
	Parts           MessageParts  `json:"content"`
	Meta            MessageMeta   `json:"meta,omitempty"`
}

type NewThreadOutput struct {
	Thread          NewThreadOutputThread         `json:"thread"`
	ResponseMessage *NewThreadOutputThreadMessage `json:"responseMessage"`
}

func (a *Application) newThreadHandler(e *core.RequestEvent) error {
	err := e.Request.ParseMultipartForm(50 * 1024 * 1024) // 50 MB limit for multipart form
	if err != nil {
		a.PB.Logger().Warn("Failed to parse multipart form in new message request", "error", err)
		return e.JSON(400, InvalidInputErrorData)
	}

	input := e.Request.MultipartForm.Value
	contentField := input["content"]
	if len(contentField) != 1 || contentField[0] == "" {
		a.PB.Logger().Warn("Content is required and cannot be empty")
		return e.JSON(400, InvalidInputErrorData)
	}
	content := contentField[0]
	inputUserMessage := UserMessage{
		Content: content,
	}

	responseModelField := input["responseModel"]
	if len(responseModelField) != 1 || responseModelField[0] == "" {
		a.PB.Logger().Warn("Response model is required and cannot be empty")
		return e.JSON(400, InvalidInputErrorData)
	}
	responseModelRaw := responseModelField[0]
	var responseModel ResponseModel
	if err := json.Unmarshal([]byte(responseModelRaw), &responseModel); err != nil {
		a.PB.Logger().Warn("Failed to unmarshal response model", "error", err)
		return e.JSON(400, InvalidInputErrorData)
	}
	if err := validate.Struct(responseModel); err != nil {
		a.PB.Logger().Warn("Validation failed for response model", "error", err)
		return e.JSON(400, InvalidInputErrorData)
	}

	// Parse attachments if any
	attachments := e.Request.MultipartForm.File["attachments"]
	if len(attachments) > 4 {
		a.PB.Logger().Warn("Too many attachments, maximum is 4")
		return e.JSON(400, map[string]string{"error": "Too many attachments, maximum is 4"})
	}
	for _, fileHeader := range attachments {
		if fileHeader.Size > 5*1024*1024 { // 5 MB limit per file
			a.PB.Logger().Warn("Attachment file size exceeds limit", "fileName", fileHeader.Filename, "size", fileHeader.Size)
			return e.JSON(400, map[string]string{"error": "Attachment file size exceeds limit of 5MB"})
		}
	}

	userID := e.Auth.Id

	threadsCollection, err := a.PB.FindCollectionByNameOrId("threads")
	if err != nil {
		a.PB.Logger().Error("Failed to find threads collection", "error", err)
		return e.JSON(500, UnexpectedErrorData)
	}
	threadID, err := NewUUIDv7b32()
	if err != nil {
		a.PB.Logger().Error("Failed to generate new thread ID", "error", err)
		return e.JSON(500, UnexpectedErrorData)
	}

	threadRecord := core.NewRecord(threadsCollection)
	threadRecord.Set("id", threadID.String())
	threadRecord.Set("owner_user_id", userID)
	threadRecord.Set("title", "New Thread")
	threadRecord.Set("title_generation_status", ThreadTitleGenerationStatusGenerating)

	var userMessage *NewThreadOutputThreadMessage
	var responseMessage *NewThreadOutputThreadMessage

	err = a.PB.RunInTransaction(func(txApp core.App) error {
		if err := txApp.Save(threadRecord); err != nil {
			return fmt.Errorf("failed to save new thread record: %w", err)
		}

		userMessage, responseMessage, err = a.createNewMessageWithResponse(
			txApp,
			userID,
			threadID.String(),
			inputUserMessage,
			responseModel,
			attachments,
		)

		if err != nil {
			return fmt.Errorf("failed to create new message with response: %w", err)
		}

		return nil
	})

	if err != nil {
		a.PB.Logger().Error("Failed to create new message with response", "error", err)
		return e.JSON(500, UnexpectedErrorData)
	}

	if err != nil {
		a.PB.Logger().Error("Failed to create new thread with message", "error", err)
		return e.JSON(500, UnexpectedErrorData)
	}
	_, err = a.StreamService.StartStream(responseMessage.ID, userID, responseModel)
	if err != nil {
		a.PB.Logger().Error("Failed to start stream for new thread message", "error", err, "threadID", threadID.String(), "messageID", responseMessage.ID)
		return e.JSON(500, UnexpectedErrorData)
	}

	_ = a.setThreadTitleFromFirstMessage(userID, threadRecord.Id, userMessage.ID)

	return e.JSON(200, map[string]any{
		"message": "Thread created successfully",
		"data": NewThreadOutput{
			Thread: NewThreadOutputThread{
				ID:      threadRecord.Id,
				Created: threadRecord.GetString("created"),
				Updated: threadRecord.GetString("updated"),
			},
			ResponseMessage: responseMessage,
		},
	})
}

func (a *Application) newMessageInThreadHandler(e *core.RequestEvent) error {

	threadID := e.Request.PathValue("threadId")
	if threadID == "" {
		a.PB.Logger().Warn("Thread ID is missing in request path")
		return e.JSON(400, InvalidInputErrorData)
	}
	if len(threadID) != 26 {
		a.PB.Logger().Warn("Invalid thread ID length", "threadID", threadID)
		return e.JSON(400, InvalidInputErrorData)
	}
	userID := e.Auth.Id
	a.PB.Logger().Info("Creating new message in thread", "threadID", threadID, "userID", userID)

	err := e.Request.ParseMultipartForm(50 * 1024 * 1024) // 50 MB limit for multipart form
	if err != nil {
		a.PB.Logger().Warn("Failed to parse multipart form in new message request", "error", err)
		return e.JSON(400, InvalidInputErrorData)
	}

	input := e.Request.MultipartForm.Value

	contentField := input["content"]
	if len(contentField) != 1 || contentField[0] == "" {
		a.PB.Logger().Warn("Content is required and cannot be empty")
		return e.JSON(400, InvalidInputErrorData)
	}
	content := contentField[0]
	parentMessageIDField := input["parentMessageId"]
	if len(parentMessageIDField) > 1 {
		a.PB.Logger().Warn("Parent message ID should not be an array")
		return e.JSON(400, InvalidInputErrorData)
	}
	var parentMessageID string
	if len(parentMessageIDField) == 1 && parentMessageIDField[0] != "" {
		parentMessageID = parentMessageIDField[0]
		if len(parentMessageID) != 26 {
			a.PB.Logger().Warn("Invalid parent message ID length", "parentMessageID", parentMessageID)
			return e.JSON(400, InvalidInputErrorData)
		}
	} else {
		parentMessageID = "" // No parent message ID provided
	}

	inputUserMessage := UserMessage{
		Content:         content,
		ParentMessageID: parentMessageID,
	}

	responseModelField := input["responseModel"]
	if len(responseModelField) != 1 || responseModelField[0] == "" {
		a.PB.Logger().Warn("Response model is required and cannot be empty")
		return e.JSON(400, InvalidInputErrorData)
	}
	responseModelRaw := responseModelField[0]
	var responseModel ResponseModel
	if err := json.Unmarshal([]byte(responseModelRaw), &responseModel); err != nil {
		a.PB.Logger().Warn("Failed to unmarshal response model", "error", err)
		return e.JSON(400, InvalidInputErrorData)
	}
	if err := validate.Struct(responseModel); err != nil {
		a.PB.Logger().Warn("Validation failed for response model", "error", err)
		return e.JSON(400, InvalidInputErrorData)
	}

	// Parse attachments if any
	attachments := e.Request.MultipartForm.File["attachments"]
	if len(attachments) > 4 {
		a.PB.Logger().Warn("Too many attachments, maximum is 4")
		return e.JSON(400, map[string]string{"error": "Too many attachments, maximum is 4"})
	}
	for _, fileHeader := range attachments {
		if fileHeader.Size > 5*1024*1024 { // 5 MB limit per file
			a.PB.Logger().Warn("Attachment file size exceeds limit", "fileName", fileHeader.Filename, "size", fileHeader.Size)
			return e.JSON(400, map[string]string{"error": "Attachment file size exceeds limit of 5MB"})
		}
	}

	userMessage, responseMessage, err := a.createNewMessageWithResponse(
		a.PB,
		userID,
		threadID,
		inputUserMessage,
		responseModel,
		attachments,
	)
	if err != nil {
		a.PB.Logger().Error("Failed to create new message with response", "error", err)
		return e.JSON(500, UnexpectedErrorData)
	}
	_, err = a.StreamService.StartStream(responseMessage.ID, userID, responseModel)
	if err != nil {
		a.PB.Logger().Error("Failed to start stream for new message", "error", err, "threadID", threadID, "messageID", responseMessage.ID)
		return e.JSON(500, UnexpectedErrorData)
	}

	return e.JSON(200, map[string]any{
		"userMessageId":     userMessage.ID,
		"responseMessageId": responseMessage.ID,
	})
}

type UpdateMessageInThreadInput struct {
	Content       string        `json:"content" validate:"required,max=50000"`
	ResponseModel ResponseModel `json:"responseModel" validate:"required"`
}

// updateMessageInThreadHandler updates the content of an existing user message in a thread, copies over everything else
func (a *Application) updateMessageInThreadHandler(e *core.RequestEvent) error {
	messageID := e.Request.PathValue("messageId")
	if len(messageID) != 26 {
		a.PB.Logger().Warn("Invalid message ID length", "messageID", messageID)
		return e.JSON(400, InvalidInputErrorData)
	}

	var input UpdateMessageInThreadInput
	jsonDecoder := json.NewDecoder(e.Request.Body)
	if err := jsonDecoder.Decode(&input); err != nil {
		a.PB.Logger().Warn("Failed to decode update message request", "error", err)
		return e.JSON(400, InvalidInputErrorData)
	}
	if err := validate.Struct(input); err != nil {
		a.PB.Logger().Warn("Validation failed for update message input", "error", err)
		return e.JSON(400, InvalidInputErrorData)
	}

	a.PB.Logger().Info("Updating message in thread", "messageID", messageID, "userID", e.Auth.Id)

	messageRecord, err := a.PB.FindRecordById("messages", messageID)
	if err != nil {
		a.PB.Logger().Error("Failed to find message record", "error", err, "messageID", messageID)
		return e.JSON(500, UnexpectedErrorData)
	}

	if messageRecord.GetString("owner_user_id") != e.Auth.Id ||
		messageRecord.GetString("role") != string(MessageRoleUser) {
		a.PB.Logger().Warn("User does not have permission to update this message", "userID", e.Auth.Id, "messageID", messageID)
		return e.JSON(400, InvalidInputErrorData)
	}

	newMessageRecordId, err := NewUUIDv7b32()
	if err != nil {
		a.PB.Logger().Error("Failed to generate new message ID", "error", err)
		return e.JSON(500, UnexpectedErrorData)
	}
	messageRecord.MarkAsNew()
	messageRecord.Set("id", newMessageRecordId.String())

	messageRecord.Set("parts", MessageParts{Content: input.Content})
	var messageMeta MessageMeta
	if err := messageRecord.UnmarshalJSONField("meta", &messageMeta); err != nil {
		a.PB.Logger().Error("Failed to unmarshal message meta", "error", err, "messageID", messageID)
		return e.JSON(500, UnexpectedErrorData)
	}
	if messageMeta.Edited == false {
		messageMeta.Edited = true
		messageMeta.OriginalMessageID = messageID
		messageRecord.Set("meta", messageMeta)
	}

	responseMessageId, err := NewUUIDv7b32()
	if err != nil {
		a.PB.Logger().Error("Failed to generate new response message ID", "error", err)
		return e.JSON(500, UnexpectedErrorData)
	}

	//messageRecord.Fil

	responseMessageRecord := core.NewRecord(messageRecord.Collection())
	responseMessageRecord.Set("id", responseMessageId.String())
	responseMessageRecord.Set("parent_thread_id", messageRecord.GetString("parent_thread_id"))
	responseMessageRecord.Set("parent_message_id", newMessageRecordId.String())
	responseMessageRecord.Set("owner_user_id", e.Auth.Id)
	responseMessageRecord.Set("role", string(MessageRoleAssistant))
	responseMessageRecord.Set("model", input.ResponseModel.ProviderID)
	responseMeta := MessageMeta{
		ModelOptions: input.ResponseModel.Options,
	}
	responseMessageRecord.Set("meta", responseMeta)
	responseMessageRecord.Set("status", MessageStatusPending)

	err = a.PB.RunInTransaction(func(txApp core.App) error {
		if err := txApp.Save(messageRecord); err != nil {
			return fmt.Errorf("failed to save updated user message record: %w", err)
		}

		if err := txApp.Save(responseMessageRecord); err != nil {
			return fmt.Errorf("failed to save new response message record: %w", err)
		}
		return nil
	})
	if err != nil {
		a.PB.Logger().Error("Failed to update message in thread", "error", err, "messageID", messageID)
		return e.JSON(500, UnexpectedErrorData)
	}
	// Start a new stream for the response message
	_, err = a.StreamService.StartStream(responseMessageRecord.Id, e.Auth.Id, input.ResponseModel)
	if err != nil {
		a.PB.Logger().Error("Failed to start stream for updated message", "error", err, "messageID", responseMessageRecord.Id)
		return e.JSON(500, UnexpectedErrorData)
	}

	return e.JSON(200, map[string]any{
		"message": "Message updated successfully",
	})
}

type RegenerateMessageInThreadInput struct {
	// Content is optional, if provided it implies the user wants to edit the message.
	Content string `json:"content" validate:"omitempty,max=50000"`
	// ResponseModel is optional, if provided it implies the user wants to use a different model for the regeneration.
	ResponseModel ResponseModel `json:"responseModel" validate:"required"`
}

// regenerateMessageInThreadHandler used to regenerate an ai message, or for a user to edit it.
func (a *Application) regenerateMessageInThreadHandler(e *core.RequestEvent) error {
	threadID := e.Request.PathValue("threadId")
	if len(threadID) != 26 {
		a.PB.Logger().Warn("Invalid thread ID length", "threadID", threadID)
		return e.JSON(400, InvalidInputErrorData)
	}
	messageID := e.Request.PathValue("messageId")
	if len(messageID) != 26 {
		a.PB.Logger().Warn("Invalid message ID length", "messageID", messageID)
		return e.JSON(400, InvalidInputErrorData)
	}

	var input RegenerateMessageInThreadInput
	jsonDecoder := json.NewDecoder(e.Request.Body)
	if err := jsonDecoder.Decode(&input); err != nil {
		a.PB.Logger().Warn("Failed to decode regenerate message request", "error", err)
		return e.JSON(400, InvalidInputErrorData)
	}
	if err := validate.Struct(input); err != nil {
		a.PB.Logger().Warn("Validation failed for regenerate message input", "error", err)
		return e.JSON(400, InvalidInputErrorData)
	}

	a.PB.Logger().Info("Regenerating message in thread", "threadID", threadID, "messageID", messageID, "userID", e.Auth.Id, "model", input.ResponseModel, "content", len(input.Content) > 0)

	err := a.regenerateMessage(
		e.Auth.Id,
		threadID,
		messageID,
		input,
	)
	if err != nil {
		a.PB.Logger().Error("Failed to regenerate message with response", "error", err)
		return e.JSON(500, UnexpectedErrorData)
	}

	return e.JSON(200, map[string]any{
		"message": "Message regenerated successfully",
	})
}

// TODO: Send chunks other than content and reasoning

func (a *Application) streamMessageHandler(e *core.RequestEvent) error {
	messageID := e.Request.PathValue("messageId")
	if len(messageID) != 26 {
		a.PB.Logger().Warn("Invalid message ID length", "messageID", messageID)
		return e.JSON(400, InvalidInputErrorData)
	}
	userID := e.Auth.Id

	a.PB.Logger().Info("Streaming message", "messageID", messageID)

	e.Response.Header().Set("Content-Type", "text/event-stream")
	e.Response.Header().Set("Cache-Control", "no-cache")
	e.Response.Header().Set("Connection", "keep-alive")

	disconnectChan := e.Request.Context().Done()

	rc := http.NewResponseController(e.Response)
	stream, ok, err := a.StreamService.GetActiveStream(messageID, userID)
	if err != nil {
		a.PB.Logger().Error("Failed to get stream for message", "error", err, "messageID", messageID)
		return e.JSON(500, UnexpectedErrorData)
	}
	if !ok {
		// Stream already finished or not found, try getting completed message from database
		a.PB.Logger().Info("Stream not found or already finished, fetching completed message", "messageID", messageID)
		messageRecord, err := a.PB.FindRecordById("messages", messageID)
		if err != nil {
			a.PB.Logger().Error("Failed to find message record", "error", err, "messageID", messageID)
			return e.JSON(500, UnexpectedErrorData)
		}
		if messageRecord == nil {
			a.PB.Logger().Warn("Message record not found", "messageID", messageID)
			return e.JSON(404, map[string]string{"error": "Message not found"})
		}
		// If the message is already completed, we can send it directly
		a.PB.Logger().Info("Message already completed, sending directly", "messageID", messageID)
		var messageParts MessageParts
		err = messageRecord.UnmarshalJSONField("parts", &messageParts)
		if err != nil {
			a.PB.Logger().Error("Failed to unmarshal message content", "error", err, "messageID", messageID)
			return e.JSON(500, UnexpectedErrorData)
		}
		if messageParts.Reasoning != "" {
			reasoningMsg, err := json.Marshal(Chunk{
				Type:    ChunkTypeReasoning,
				Content: messageParts.Reasoning,
			})
			if err != nil {
				a.PB.Logger().Error("Failed to marshal reasoning message", "error", err, "messageID", messageID)
				return e.JSON(500, UnexpectedErrorData)
			}
			_, err = e.Response.Write([]byte(fmt.Sprintf("data: %s\n\n", reasoningMsg)))
			if err != nil {
				a.PB.Logger().Error("Failed to write reasoning to response stream", "error", err, "messageID", messageID)
				return e.JSON(500, UnexpectedErrorData)
			}
		}
		contentMsg, err := json.Marshal(Chunk{
			Type:    ChunkTypeContent,
			Content: messageParts.Content,
		})
		if err != nil {
			a.PB.Logger().Error("Failed to marshal content message", "error", err, "messageID", messageID)
			return e.JSON(500, UnexpectedErrorData)
		}
		_, err = e.Response.Write([]byte(fmt.Sprintf("data: %s\n\n", contentMsg)))
		if err != nil {
			a.PB.Logger().Error("Failed to write content to response stream", "error", err, "messageID", messageID)
			return e.JSON(500, UnexpectedErrorData)
		}
		if err := rc.Flush(); err != nil {
			a.PB.Logger().Error("Failed to flush response stream", "error", err, "messageID", messageID)
			return e.JSON(500, UnexpectedErrorData)
		}
		return nil
	}
	subscriberId := fmt.Sprintf("%s-%d", messageID, time.Now().UnixNano())
	responseChan := stream.Subscribe(subscriberId)

	// heartbeat to keep the connection alive
	heartbeatTicker := time.NewTicker(30 * time.Second)
	defer heartbeatTicker.Stop()

	for {
		select {
		case <-disconnectChan:
			a.PB.Logger().Info("Client disconnected", "messageID", messageID)
			stream.Unsubscribe(subscriberId)
			return nil
		case <-heartbeatTicker.C:
			_, err := e.Response.Write([]byte(": don't die on me\n\n"))
			if err != nil {
				a.PB.Logger().Error("Failed to write heartbeat to response stream", "error", err, "messageID", messageID)
				return e.JSON(500, UnexpectedErrorData)
			}
			if err := rc.Flush(); err != nil {
				a.PB.Logger().Error("Failed to flush heartbeat response stream", "error", err, "messageID", messageID)
				return e.JSON(500, UnexpectedErrorData)
			}
		case response, ok := <-responseChan:
			if !ok {
				a.PB.Logger().Info("Response channel closed", "messageID", messageID)
				return nil
			}
			msg, err := json.Marshal(response)
			if err != nil {
				a.PB.Logger().Error("Failed to marshal response for streaming", "error", err, "messageID", messageID)
				return e.JSON(500, UnexpectedErrorData)
			}
			_, err = e.Response.Write([]byte(fmt.Sprintf("data: %s\n\n", msg)))
			if err != nil {
				a.PB.Logger().Error("Failed to write response to stream", "error", err, "messageID", messageID)
				return e.JSON(500, UnexpectedErrorData)
			}
			if err := rc.Flush(); err != nil {
				a.PB.Logger().Error("Failed to flush response stream", "error", err, "messageID", messageID)
				return e.JSON(500, UnexpectedErrorData)
			}
		}

	}
}

func (a *Application) getKeyInfoHandler(e *core.RequestEvent) error {
	userID := e.Auth.Id
	if userID == "" {
		a.PB.Logger().Warn("User ID is missing in request context")
		return e.JSON(400, InvalidInputErrorData)
	}

	// Get key id from path
	keyID := e.Request.PathValue("keyId")
	if keyID == "" {
		a.PB.Logger().Warn("Key ID is missing in request path")
		return e.JSON(400, InvalidInputErrorData)
	}
	// Get key from database
	keyRecord, err := a.PB.FindRecordById("api_keys", keyID)
	if err != nil {
		a.PB.Logger().Error("Failed to find key record", "error", err, "keyID", keyID)
		return e.JSON(500, UnexpectedErrorData)
	}
	// Check user is the owner of the key
	if keyRecord == nil || keyRecord.GetString("owner_user_id") != userID {
		a.PB.Logger().Warn("Key not found or user is not the owner", "keyID", keyID, "userID", userID)
		return e.JSON(404, map[string]string{"error": "Key not found or access denied"})
	}

	key := keyRecord.GetString("key")
	// Fetch key info from OpenRouter API
	request, err := http.NewRequest("GET", "https://openrouter.ai/api/v1/key", nil)
	if err != nil {
		a.PB.Logger().Error("Failed to create request for OpenRouter API", "error", err, "keyID", keyID)
		return e.JSON(500, UnexpectedErrorData)
	}
	request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", key))
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		a.PB.Logger().Error("Failed to fetch key info from OpenRouter API", "error", err, "keyID", keyID)
		return e.JSON(500, UnexpectedErrorData)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		a.PB.Logger().Error("Failed to fetch key info from OpenRouter API", "statusCode", response.StatusCode, "keyID", keyID)
		return e.JSON(response.StatusCode, map[string]string{"error": "Failed to fetch key info from OpenRouter API"})
	}
	var keyInfo map[string]any
	a.PB.Logger().Info("Successfully fetched key info from OpenRouter API", "keyID", keyID)
	if err := json.NewDecoder(response.Body).Decode(&keyInfo); err != nil {
		a.PB.Logger().Error("Failed to decode key info response", "error", err, "keyID", keyID)
		return e.JSON(500, UnexpectedErrorData)
	}

	return e.JSON(200, keyInfo)
}

type SearchResultThread struct {
	ID       string        `json:"id" db:"id"`
	Title    string        `json:"title" db:"title"`
	Messages types.JSONRaw `json:"messages" db:"messages"`
}

// searchThreadsHandler searches for threads based on a query string that exists either in the thread title or in the content of the messages within the thread.
// returns a list of threads and array of its messages
func (a *Application) searchThreadsHandler(e *core.RequestEvent) error {
	query := e.Request.URL.Query().Get("query")
	if query == "" {
		a.PB.Logger().Warn("Query parameter is missing or empty")
		return e.JSON(400, InvalidInputErrorData)
	}

	userID := e.Auth.Id
	a.PB.Logger().Info("Searching threads", "query", query, "userID", userID)

	var results []SearchResultThread

	err := a.PB.DB().NewQuery(`
SELECT
    t.id AS id,
    t.title AS title,
    COALESCE(
        json_group_array(
            CASE
                WHEN m.id IS NOT NULL THEN
                    json_object(
                        'id', m.id,
                        'preview',
                        CASE
                            WHEN json_extract(m.parts, '$.content') IS NOT NULL
                                THEN substr(json_extract(m.parts, '$.content'), 1, 80)
                            ELSE 'No preview'
                        END
                    )
                ELSE NULL
            END
        ) FILTER (WHERE m.id IS NOT NULL),
        json('[]')
    ) AS messages
FROM threads t
LEFT JOIN messages m
    ON m.parent_thread_id = t.id
    AND json_extract(m.parts, '$.content') LIKE '%' || {:query} || '%'
WHERE
    t.owner_user_id = {:userId} AND
    (t.title LIKE '%' || {:query} || '%'
    OR t.id IN (
        SELECT parent_thread_id FROM messages WHERE json_extract(parts, '$.content') LIKE '%' || {:query} || '%'
    ))
GROUP BY t.id, t.title
LIMIT 100;
`).Bind(
		dbx.Params{
			"userId": userID,
			"query":  query,
		}).All(&results)

	if err != nil {
		a.PB.Logger().Error("Failed to search threads", "error", err, "query", query)
		return e.JSON(500, UnexpectedErrorData)
	}

	return e.JSON(200, map[string]any{"threads": results})
}
