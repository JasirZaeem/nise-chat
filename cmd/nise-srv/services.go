package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
	"github.com/openai/openai-go/packages/param"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
	"github.com/pocketbase/pocketbase/tools/types"
	"io"
	"mime/multipart"
	"strings"
	"time"
)

type ThreadTitleGenerationStatus string

const (
	ThreadTitleGenerationStatusGenerating ThreadTitleGenerationStatus = "generating"
	ThreadTitleGenerationStatusCompleted  ThreadTitleGenerationStatus = "completed"
	ThreadTitleGenerationStatusFailed     ThreadTitleGenerationStatus = "failed"
)

func (s ThreadTitleGenerationStatus) String() string {
	return string(s)
}

type ResponseModelReasoningEffort string

const (
	ReasoningEffortOff    ResponseModelReasoningEffort = "off"
	ReasoningEffortLow    ResponseModelReasoningEffort = "low"
	ReasoningEffortMedium ResponseModelReasoningEffort = "medium"
	ReasoningEffortHigh   ResponseModelReasoningEffort = "high"
)

func (r ResponseModelReasoningEffort) String() string {
	return string(r)
}

type ResponseModelOptions struct {
	WebSearch       bool                          `json:"webSearch,omitempty,omitzero"`
	ReasoningEffort *ResponseModelReasoningEffort `json:"reasoningEffort,omitempty,omitzero" validate:"omitempty,oneof=off low medium high"`
}

type ResponseModel struct {
	ProviderID string                `json:"providerId,omitempty,omitzero"`
	Options    *ResponseModelOptions `json:"options,omitempty,omitzero"`
}

type MessageRole openai.MessageRole

const (
	MessageRoleUser      MessageRole = MessageRole(openai.MessageRoleUser)
	MessageRoleAssistant MessageRole = MessageRole(openai.MessageRoleAssistant)
	MessageRoleSystem    MessageRole = "system"
)

func (r MessageRole) String() string {
	return string(r)
}

type MessageMeta struct {
	Edited            bool                   `json:"edited,omitempty,omitzero"`
	OriginalMessageID string                 `json:"originalMessageId,omitempty,omitzero"`
	Usage             openai.CompletionUsage `json:"usage,omitempty,omitzero"`
	FinishReason      FinishReason           `json:"finishReason,omitempty,omitzero"`
	ModelOptions      *ResponseModelOptions  `json:"modelOptions,omitempty,omitzero"`
}

type MessageScalar struct {
	ID              string         `json:"id" db:"id"`
	OwnerUserID     string         `json:"ownerUserId" db:"owner_user_id"`
	ParentThreadID  string         `json:"parentThreadId" db:"parent_thread_id"`
	ParentMessageID string         `json:"parentMessageId" db:"parent_message_id"`
	Model           string         `json:"model" db:"model"`
	Role            MessageRole    `json:"role" db:"role"`
	Status          MessageStatus  `json:"status" db:"status"`
	Created         types.DateTime `json:"created" db:"created"`
	Updated         types.DateTime `json:"updated" db:"updated"`
}

type MessageDB struct {
	MessageScalar
	Attachments types.JSONArray[string] `json:"attachments,omitempty" db:"attachments"` // List of attachment file IDs
	Parts       types.JSONMap[any]      `json:"parts" db:"parts"`
	Meta        types.JSONMap[any]      `json:"meta,omitempty" db:"meta"`
}

type Message struct {
	MessageScalar
	Attachments []string     `json:"attachments,omitempty" db:"attachments"` // List of attachment file IDs
	Parts       MessageParts `json:"parts" db:"parts"`
	Meta        MessageMeta  `json:"meta,omitempty" db:"meta"`
}

type MessageStatus string

const (
	MessageStatusPending    MessageStatus = "pending"
	MessageStatusGenerating MessageStatus = "generating"
	MessageStatusCompleted  MessageStatus = "completed"
	MessageStatusFailed     MessageStatus = "failed"
	MessageStatusRefused    MessageStatus = "refused"
	MessageStatusCancelled  MessageStatus = "cancelled"
)

// JSON representation of a message status
func (s MessageStatus) String() string {
	return string(s)
}

func (a *Application) createNewMessageWithResponse(
	txPB core.App,
	ownerUserId string,
	parentThreadId string,
	input UserMessage,
	responseModel ResponseModel,
	attachments []*multipart.FileHeader,
) (*NewThreadOutputThreadMessage, *NewThreadOutputThreadMessage, error) {
	// TODO: Check for invariants:
	// - The user must be the owner of the thread
	// - The thread must exist
	// - The parent message ID must be valid (if provided)
	// - Add a param to know if this is for a new thread or an existing one, is existing, check invariants
	messagesCollection, err := txPB.FindCollectionByNameOrId("messages")
	if err != nil {
		return nil, nil, fmt.Errorf("createNewMessageWithResponse failed to find messages collection: %w", err)
	}

	userMessageRecord := core.NewRecord(messagesCollection)
	userMessageId, err := NewUUIDv7b32()
	if err != nil {
		return nil, nil, fmt.Errorf("createNewMessageWithResponse failed to generate new user message ID: %w", err)
	}
	userMessageRecord.Set("id", userMessageId.String())
	userMessageRecord.Set("parent_thread_id", parentThreadId)
	userMessageRecord.Set("parent_message_id", input.ParentMessageID)
	userMessageRecord.Set("owner_user_id", ownerUserId)
	userMessageRecord.Set("role", MessageRoleUser)
	userMessageRecord.Set("status", MessageStatusCompleted)
	userMessageParts := MessageParts{
		Content: input.Content,
	}
	userMessageRecord.Set("parts", userMessageParts)
	if len(attachments) > 0 {
		var attachmentFiles []*filesystem.File
		for _, attachment := range attachments {
			file, err := filesystem.NewFileFromMultipart(attachment)
			if err != nil {
				return nil, nil, fmt.Errorf("createNewMessageWithResponse failed to create file from attachment: %w", err)
			}
			attachmentFiles = append(attachmentFiles, file)
		}
		userMessageRecord.Set("attachments", attachmentFiles)
	}

	responseMessageRecord := core.NewRecord(messagesCollection)
	responseMessageId, err := NewUUIDv7b32()
	if err != nil {
		return nil, nil, fmt.Errorf("createNewMessageWithResponse failed to generate new response message ID: %w", err)
	}
	responseMessageRecord.Set("id", responseMessageId.String())
	responseMessageRecord.Set("parent_thread_id", parentThreadId)
	responseMessageRecord.Set("parent_message_id", userMessageId.String())
	responseMessageRecord.Set("owner_user_id", ownerUserId)
	responseMessageRecord.Set("role", MessageRoleAssistant)
	responseMessageRecord.Set("status", MessageStatusPending) // Initial status is pending
	responseMessageParts := MessageParts{}

	if responseModel.ProviderID == "echo" {
		responseMessageParts.Content = "DEV: This is a response to " + input.Content // Placeholder content
		responseMessageRecord.Set("status", MessageStatusCompleted)                  // Set status to completed for echo model
	}

	responseMessageRecord.Set("parts", responseMessageParts)
	responseMessageRecord.Set("model", responseModel.ProviderID)
	responseMessageMeta := MessageMeta{
		ModelOptions: responseModel.Options,
	}
	responseMessageRecord.Set("meta", responseMessageMeta)

	err = txPB.RunInTransaction(func(txApp core.App) error {
		if err := txApp.Save(userMessageRecord); err != nil {
			return fmt.Errorf("createNewMessageWithResponse failed to save user message: %w", err)
		}
		if err := txApp.Save(responseMessageRecord); err != nil {
			return fmt.Errorf("createNewMessageWithResponse failed to save response message: %w", err)
		}
		return nil
	})

	if err != nil {
		return nil, nil, fmt.Errorf("createNewMessageWithResponse failed to save user and response messages: %w", err)
	}

	txPB.Logger().Info(
		"created new user message and response",
		"userMessageId", userMessageId.String(),
		"responseMessageId", responseMessageRecord.Id,
		"parentThreadId", parentThreadId,
		"parentMessageId", input.ParentMessageID,
		"ownerUserId", ownerUserId,
	)

	return &NewThreadOutputThreadMessage{
			ID:              userMessageRecord.Id,
			ParentThreadID:  userMessageRecord.GetString("parent_thread_id"),
			ParentMessageID: userMessageRecord.GetString("parent_message_id"),
			Role:            userMessageRecord.GetString("role"),
			Model:           userMessageRecord.GetString("model"),
			Status:          MessageStatus(userMessageRecord.GetString("status")),
			Parts:           userMessageParts,
		},
		&NewThreadOutputThreadMessage{
			ID:              responseMessageRecord.Id,
			ParentThreadID:  responseMessageRecord.GetString("parent_thread_id"),
			ParentMessageID: responseMessageRecord.GetString("parent_message_id"),
			Role:            responseMessageRecord.GetString("role"),
			Model:           responseMessageRecord.GetString("model"),
			Status:          MessageStatus(responseMessageRecord.GetString("status")),
			Parts:           responseMessageParts,
			Meta:            responseMessageMeta,
		}, nil
}

func (a *Application) regenerateMessage(userID, threadID, messageID string, input RegenerateMessageInThreadInput) error {
	// Find the message to regenerate
	messagesCollection, err := a.PB.FindCollectionByNameOrId("messages")
	if err != nil {
		a.PB.Logger().Error("Failed to find messages collection", "error", err)
		return fmt.Errorf("failed to find messages collection: %w", err)
	}
	messageRecord, err := a.PB.FindRecordById(messagesCollection.Name, messageID)
	if err != nil {
		a.PB.Logger().Error("Failed to find message record", "error", err, "messageID", messageID)
		return fmt.Errorf("failed to find message record: %w", err)
	}
	if messageRecord.GetString("parent_thread_id") != threadID ||
		messageRecord.GetString("owner_user_id") != userID ||
		messageRecord.GetString("role") != string(MessageRoleAssistant) {
		a.PB.Logger().Warn("Message invariants not met for regeneration",
			"messageID", messageID,
			"threadID", threadID,
			"userID", userID,
			"role", messageRecord.GetString("role"),
		)
		return fmt.Errorf("message not found or does not belong to the user or thread")
	}

	newMessageId, err := NewUUIDv7b32()
	if err != nil {
		a.PB.Logger().Error("Failed to generate new message ID for regeneration", "error", err)
		return fmt.Errorf("failed to generate new message ID: %w", err)
	}
	messageRecord.MarkAsNew()
	messageRecord.Set("id", newMessageId.String())    // Set a new ID for the regenerated message
	messageRecord.Set("status", MessageStatusPending) // Set status to pending for regeneration

	// Get the parts of the message, replace content if provided by user, reset them if not
	var messageParts MessageParts
	err = messageRecord.UnmarshalJSONField("parts", &messageParts)
	if err != nil {
		return fmt.Errorf("failed to unmarshal message parts: %w", err)
	}
	// Get metadata of the message
	var messageMeta MessageMeta

	messageRecord.Set("model", input.ResponseModel.ProviderID)
	messageMeta.ModelOptions = input.ResponseModel.Options

	// If content is provided, set it in the parts
	if input.Content != "" {
		messageParts.Content = input.Content
		messageMeta.Usage = openai.CompletionUsage{}        // Reset usage if content is provided
		messageMeta.Edited = true                           // Mark as edited if content is provided
		messageRecord.Set("status", MessageStatusCompleted) // Set status to completed for user edit
	} else {
		messageParts = MessageParts{} // Reset parts if no content is provided
	}

	// Update the message record to regenerate
	messageRecord.Set("parts", messageParts)
	messageRecord.Set("meta", messageMeta)

	// Save the updated message record
	err = a.PB.Save(messageRecord)
	if err != nil {
		a.PB.Logger().Error("Failed to save regenerated message", "error", err, "messageID", messageID)
		return fmt.Errorf("failed to save regenerated message: %w", err)
	}
	a.PB.Logger().Info("Regenerated message",
		"newMessageId", newMessageId.String(),
		"messageID", messageID,
		"threadID", threadID,
		"userID", userID,
	)

	// If message is supposed to be streamed, start the stream
	if messageRecord.GetString("status") == string(MessageStatusPending) {
		_, err := a.StreamService.StartStream(messageRecord.Id, userID, input.ResponseModel)
		if err != nil {
			a.PB.Logger().Error("Failed to start stream for regenerated message", "error", err, "messageID", messageID)
			return fmt.Errorf("failed to start stream for regenerated message: %w", err)
		}
	}

	return nil
}

func getThreadFiber(PB *pocketbase.PocketBase, userID, markerMessageID string) ([]MessageDB, error) {
	var messages []MessageDB
	startTime := time.Now()
	err := PB.DB().NewQuery(`
WITH RECURSIVE message_thread AS (
	SELECT *
	FROM messages
	WHERE id = {:markerMessageID}
	AND owner_user_id = {:userID}
	UNION ALL
	SELECT m.*
	FROM messages m
    INNER JOIN message_thread mt ON m.id = mt.parent_message_id
)
SELECT *
FROM message_thread
ORDER BY id ASC;
`).Bind(dbx.Params{
		"userID":          userID,
		"markerMessageID": markerMessageID,
	}).All(&messages)
	duration := time.Since(startTime)
	var threadID string
	if len(messages) > 0 {
		threadID = messages[0].ParentThreadID
	}

	PB.Logger().Info("Fetch messages for thread duration", "durationMs", duration.Milliseconds(), "threadID", threadID, "userID", userID, "markerMessageID", markerMessageID, "messagesCount", len(messages))
	if err != nil {
		PB.Logger().Error("Failed to fetch messages for thread", "error", err, "threadID", threadID, "userID", userID, "markerMessageID", markerMessageID)
		return nil, fmt.Errorf("failed to fetch messages for thread: %w", err)
	}

	return messages, nil
}

func mimeTypeFromFileName(fileName string) (string, error) {
	// Use the file extension to determine the MIME type
	ext := fileName[strings.LastIndex(fileName, "."):]
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg", nil
	case ".png":
		return "image/png", nil
	case ".pdf":
		return "application/pdf", nil
	default:
		return "", fmt.Errorf("unsupported file type: %s", ext)
	}
}

func getThreadTranscriptByLeaf(PB *pocketbase.PocketBase, userID, leafMessageID string) ([]openai.ChatCompletionMessageParamUnion, error) {
	// Fetch the thread messages in reverse order
	messages, err := getThreadFiber(PB, userID, leafMessageID)
	if err != nil {
		return nil, fmt.Errorf("failed to get thread fiber: %w", err)
	}

	fsys, err := PB.NewFilesystem()
	if err != nil {
		return nil, fmt.Errorf("failed to create filesystem: %w", err)
	}
	defer fsys.Close()

	messagesCollection, err := PB.FindCollectionByNameOrId("messages")
	if err != nil {
		return nil, fmt.Errorf("failed to find messages collection: %w", err)
	}
	messagesCollection.BaseFilesPath()

	// Convert messages to OpenAI chat completion message format
	transcript := make([]openai.ChatCompletionMessageParamUnion, 0, len(messages))
	for _, msg := range messages {
		var message openai.ChatCompletionMessageParamUnion
		if msg.Role == MessageRoleUser {
			attachments := msg.Attachments

			baseMessageId := ""
			// Check if the message is edited
			if edited, ok := msg.Meta.Get("edited").(bool); ok && edited {
				// If the message is edited, we need to get the original message ID
				if originalMessageID, ok := msg.Meta.Get("originalMessageId").(string); ok && originalMessageID != "" {
					baseMessageId = originalMessageID
				}
			} else {
				// If the message is not edited, we can use the current message ID
				baseMessageId = msg.ID
			}

			if len(attachments) == 0 {
				message = openai.UserMessage(msg.Parts.Get("content").(string))
			} else if baseMessageId != "" {

				messageContent := []openai.ChatCompletionContentPartUnionParam{
					{
						OfText: &openai.ChatCompletionContentPartTextParam{
							Text: msg.Parts.Get("content").(string),
							Type: "text",
						},
					},
				}

				for _, attachment := range msg.Attachments {

					attachmentKey := messagesCollection.BaseFilesPath() + "/" + baseMessageId + "/" + attachment
					r, err := fsys.GetReader(attachmentKey)
					if err != nil {
						return nil, fmt.Errorf("failed to get attachment reader for %s: %w", attachmentKey, err)
					}
					attachmentContent := new(bytes.Buffer)
					_, err = io.Copy(attachmentContent, r)
					r.Close()
					if err != nil {
						return nil, fmt.Errorf("failed to read attachment content for %s: %w", attachmentKey, err)
					}
					// Make a base64 encoded url for the attachment
					mimeType, err := mimeTypeFromFileName(attachment)
					if err != nil {
						return nil, fmt.Errorf("failed to determine MIME type for attachment %s: %w", attachment, err)
					}
					attachmentURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(attachmentContent.Bytes()))

					if mimeType == "image/png" || mimeType == "image/jpeg" {
						messageContent = append(messageContent, openai.ChatCompletionContentPartUnionParam{
							OfImageURL: &openai.ChatCompletionContentPartImageParam{
								ImageURL: openai.ChatCompletionContentPartImageImageURLParam{
									URL: attachmentURL,
								},
								Type: "image_url",
							},
						})
					} else {
						messageContent = append(messageContent, openai.ChatCompletionContentPartUnionParam{
							OfFile: &openai.ChatCompletionContentPartFileParam{
								File: openai.ChatCompletionContentPartFileFileParam{
									FileData: param.Opt[string]{
										Value: attachmentURL,
									},
									FileID: param.Opt[string]{},
									Filename: param.Opt[string]{
										Value: attachmentKey,
									},
								},
								Type: "file",
							},
						})
					}

				}
				message = openai.UserMessage(messageContent)
			}
		} else {
			message = openai.AssistantMessage(msg.Parts.Get("content").(string))
		}

		transcript = append(transcript, message)
	}

	return transcript, nil
}

func getThreadTranscriptUntilParent(PB *pocketbase.PocketBase, userID, leafMessageID string) ([]openai.ChatCompletionMessageParamUnion, error) {
	// Get parent, if it exists, get transcript for it, otherwise return empty transcript
	leafMessage, err := PB.FindRecordById("messages", leafMessageID)
	if err != nil {
		return nil, fmt.Errorf("failed to find leaf message: %w", err)
	}
	parentMessageID := leafMessage.GetString("parent_message_id")
	if parentMessageID == "" {
		return []openai.ChatCompletionMessageParamUnion{}, nil // No parent, return empty transcript
	}
	return getThreadTranscriptByLeaf(PB, userID, parentMessageID)
}

const TitlingModel = "meta-llama/llama-3.1-8b-instruct"

// Not using structured output for now to use faster models

type GeneratedTitle struct {
	Title string `json:"title" validate:"required,max=250,min=1"`
}

var generatedTitleSchema = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"title": map[string]any{
			"type":        "string",
			"description": "The generated title for the thread",
			"maxLength":   250,
			"minLength":   1,
		},
	},
	"required": []string{"title"},
}

func (a *Application) setThreadTitleFromFirstMessage(userID, threadID, messageID string) error {
	// Find the message
	messageRecord, err := a.PB.FindRecordById("messages", messageID)
	if err != nil {
		return fmt.Errorf("failed to find message record: %w", err)
	}
	// Check if message belongs to the thread
	if messageRecord.GetString("parent_thread_id") != threadID {
		return fmt.Errorf("message does not belong to the thread")
	}
	// Get the content of the message
	var messageParts MessageParts
	err = messageRecord.UnmarshalJSONField("parts", &messageParts)
	if err != nil {
		return fmt.Errorf("failed to unmarshal message parts: %w", err)
	}
	messageContent := messageParts.Content

	// Launch title generation in a goroutine to avoid blocking
	go a.generateAndSetThreadTitle(userID, threadID, messageContent)

	return nil
}

// generateAndSetThreadTitle generates a title for a thread based on the first message content
// and sets it on the thread record. It includes a 5-second timeout.
func (a *Application) generateAndSetThreadTitle(userID, threadID, messageContent string) {
	startTime := time.Now()
	// Create a context with a 5-second timeout for the title generation
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	//schemaParam := openai.ResponseFormatJSONSchemaJSONSchemaParam{
	//	Name:        "generated-title",
	//	Description: openai.String("The generated title for the thread"),
	//	Schema:      generatedTitleSchema,
	//	Strict:      openai.Bool(true),
	//}

	var success bool
	defer func() {
		if !success {
			tr, err := a.PB.FindRecordById("threads", threadID)
			if err != nil {
				a.PB.Logger().Error("Failed to find thread record for error status update", "error", err, "threadID", threadID)
				return
			}
			tr.Set("title_generation_status", ThreadTitleGenerationStatusFailed)
			if err := a.PB.Save(tr); err != nil {
				a.PB.Logger().Error("Failed to save thread record with failed title status", "error", err, "threadID", threadID)
			}
		}
	}()

	// Get user's api key from the database
	apiKeyRecord, err := a.PB.FindFirstRecordByData("api_keys", "owner_user_id", userID)
	if err != nil {
		a.PB.Logger().Error("failed to find API key record", "error", err, "userID", userID)
		return
	}
	if apiKeyRecord == nil {
		a.PB.Logger().Error("no API key found for user", "userID", userID)
		return
	}
	apiKey := apiKeyRecord.GetString("key")

	chat, err := a.AIClient.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage("You are generating a title for a chat thread between a user and an AI assistant. You are given the first message in the thread by the user. Generate a concise and descriptive title for the thread based on this message. Output only the title and nothing else."),
			openai.UserMessage(fmt.Sprintf(`<first_message>%s</first_message>`, messageContent)),
		},
		Model:               TitlingModel,
		MaxCompletionTokens: openai.Opt[int64](330),
		//ResponseFormat: openai.ChatCompletionNewParamsResponseFormatUnion{
		//	OfJSONSchema: &openai.ResponseFormatJSONSchemaParam{JSONSchema: schemaParam},
		//},
	},
		// OpenRouter options
		option.WithJSONSet("provider", map[string]any{
			"require_parameters": true,
			"order": []string{
				"cerebras/fp16",
				"groq",
			},
			"allow_fallbacks": true,
			"data_collection": "deny",
		}),
		option.WithAPIKey(apiKey),
	)
	if err != nil {
		a.PB.Logger().Error("failed to generate title", "error", err, "threadID", threadID)
		return
	}

	threadRecord, err := a.PB.FindRecordById("threads", threadID)
	if err != nil {
		a.PB.Logger().Error("failed to find thread record", "error", err, "threadID", threadID)
		return
	}
	// Check if the title is already set
	if threadRecord.GetString("title") != "New Thread" {
		a.PB.Logger().Info("thread title is already set, skipping", "threadID", threadID)
		success = true
		return
	}
	if len(chat.Choices) == 0 {
		a.PB.Logger().Error("no choices returned from AI client, cannot set thread title", "threadID", threadID)
		return
	}

	//var generatedTitle GeneratedTitle
	//err = json.Unmarshal([]byte(chat.Choices[0].Message.Content), &generatedTitle)
	//if err != nil {
	//	a.PB.Logger().Error("failed to unmarshal generated title", "error", err, "threadID", threadID)
	//	return
	//}
	//err = validate.Struct(&generatedTitle)
	//if err != nil {
	//	a.PB.Logger().Error("generated title validation failed", "error", err, "threadID", threadID)
	//	return
	//}

	title := chat.Choices[0].Message.Content
	// Limit the title to 250 characters
	if len(title) > 250 {
		title = title[:250]
	}
	// If the title is surrounded by quotes, remove them, ', ", or `
	if len(title) > 1 && ((title[0] == '"' && title[len(title)-1] == '"') ||
		(title[0] == '\'' && title[len(title)-1] == '\'') ||
		(title[0] == '`' && title[len(title)-1] == '`')) {
		title = title[1 : len(title)-1]
	}
	threadRecord.Set("title", title)
	threadRecord.Set("title_generation_status", ThreadTitleGenerationStatusCompleted)
	err = a.PB.Save(threadRecord)
	if err != nil {
		a.PB.Logger().Error("failed to save thread record with generated title", "error", err, "threadID", threadID)
		return
	}
	success = true
	endTime := time.Now()
	a.PB.Logger().Info("successfully set thread title", "threadID", threadID, "title", title, "timeTakenMs", endTime.Sub(startTime).Milliseconds())
}
