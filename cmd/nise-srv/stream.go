package main

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
	"github.com/openai/openai-go/packages/ssestream"
	"github.com/pocketbase/pocketbase"
	"strings"
	"sync"
	"time"
)

type StreamSubscriber struct {
	ID      string
	Channel chan Chunk
}

type MessageParts struct {
	Content   string `json:"content"`
	Reasoning string `json:"reasoning,omitempty"` // Optional reasoning field
	// What else do we need?
	Error string `json:"error,omitempty"` // Optional error field
}

type Chunk struct {
	Type    ChunkType `json:"t"`
	Content string    `json:"c"`
}

type ActiveStream struct {
	MessageID  string
	UserID     string
	Transcript []openai.ChatCompletionMessageParamUnion
	Model      ResponseModel

	chunks         []Chunk
	builtContent   strings.Builder
	builtReasoning strings.Builder
	chunkMutex     sync.Mutex

	subscribers     map[string]*StreamSubscriber
	subscriberMutex sync.Mutex

	complete bool

	ctx    context.Context
	cancel context.CancelFunc
}

func NewActiveStream(messageID, userID string, transcript []openai.ChatCompletionMessageParamUnion, model ResponseModel) *ActiveStream {
	ctx, cancel := context.WithCancel(context.Background())
	return &ActiveStream{
		MessageID:  messageID,
		UserID:     userID,
		Transcript: transcript,
		Model:      model,

		chunks:     []Chunk{},
		chunkMutex: sync.Mutex{},

		subscribers:     make(map[string]*StreamSubscriber),
		subscriberMutex: sync.Mutex{},

		complete: false,

		ctx:    ctx,
		cancel: cancel,
	}
}

type StreamService struct {
	PB            *pocketbase.PocketBase
	aiClient      openai.Client
	activeStreams sync.Map // map[string]*ActiveStream
}

func NewStreamService(app *pocketbase.PocketBase, aiClient openai.Client) *StreamService {
	return &StreamService{
		PB:            app,
		aiClient:      aiClient,
		activeStreams: sync.Map{},
	}
}

func (s *StreamService) StartStream(messageID, userID string, model ResponseModel) (*ActiveStream, error) {
	s.PB.Logger().Debug("Starting new stream", "messageID", messageID, "userID", userID)

	var transcript []openai.ChatCompletionMessageParamUnion

	transcript, err := getThreadTranscriptUntilParent(s.PB, userID, messageID)
	if err != nil {
		s.PB.Logger().Error("Failed to get thread transcript", "messageID", messageID, "userID", userID, "error", err)
		return nil, fmt.Errorf("failed to get thread transcript: %w", err)
	}

	stream := NewActiveStream(messageID, userID, transcript, model)
	// Set message status to generating
	messageRecord, err := s.PB.FindRecordById("messages", messageID)
	if err != nil {
		s.PB.Logger().Error("Failed to find message record", "messageID", messageID, "error", err)
		return nil, fmt.Errorf("failed to find message record: %w", err)
	}
	messageRecord.Set("status", MessageStatusGenerating)
	if err := s.PB.Save(messageRecord); err != nil {
		s.PB.Logger().Error("Failed to save message record", "messageID", messageID, "error", err)
		return nil, fmt.Errorf("failed to save message record: %w", err)
	}

	s.activeStreams.Store(messageID, stream)

	go s.consumeStream(stream)

	return stream, nil
}

// GetActiveStream retrieves an active stream by its message ID.
func (s *StreamService) GetActiveStream(messageID, userID string) (*ActiveStream, bool, error) {
	stream, ok := s.activeStreams.Load(messageID)
	if !ok {
		return nil, false, nil
	}

	activeStream, ok := stream.(*ActiveStream)
	if !ok {
		return nil, false, fmt.Errorf("active stream for message ID %s is not of type *ActiveStream", messageID)
	}

	// Check if the user ID matches
	if activeStream.UserID != userID {
		return nil, false, fmt.Errorf("active stream for message ID %s does not belong to user ID %s", messageID, userID)
	}

	return activeStream, true, nil
}

// TODO: Track reasoning time

func (s *StreamService) consumeStream(stream *ActiveStream) {
	startTime := time.Now()
	var streamErr error
	var finishReason FinishReason
	var acc openai.ChatCompletionAccumulator

	defer func() {
		model := stream.Model
		// If error occurred, send a finish reason chunk
		if streamErr != nil {
			s.PB.Logger().Error("Stream error occurred", "messageID", stream.MessageID, "error", streamErr)
			stream.addChunk("Error: "+streamErr.Error(), ChunkTypeError)
			finishReason = FinishReasonError
		}
		if finishReason == "" {
			finishReason = FinishReasonUnknown
		}
		stream.addChunk(string(finishReason), ChunkTypeFinishReason)

		s.activeStreams.Delete(stream.MessageID)
		stream.cancel()

		stream.subscriberMutex.Lock()
		for _, subscriber := range stream.subscribers {
			close(subscriber.Channel)
		}
		stream.subscriberMutex.Unlock()
		s.PB.Logger().Debug("Stream consumed and cleaned up", "messageID", stream.MessageID, "duration", time.Since(startTime))

		// Always update the message in the database with error if any
		messageCollection, err := s.PB.FindCollectionByNameOrId("messages")
		if err != nil {
			s.PB.Logger().Error("Failed to find messages collection", "error", err)
			return
		}

		message, err := s.PB.FindRecordById(messageCollection, stream.MessageID)
		if err != nil {
			s.PB.Logger().Error("Failed to find message record", "messageID", stream.MessageID, "error", err)
			return
		}

		content := ""
		if len(acc.ChatCompletion.Choices) > 0 {
			content = acc.ChatCompletion.Choices[0].Message.Content
		} else {
			content = "No content received"
		}
		message.Set("content", content)

		errStr := ""
		if streamErr != nil {
			errStr = streamErr.Error()
		}
		messageParts := MessageParts{Content: content, Error: errStr}
		messageMeta := MessageMeta{
			Edited:       false,
			Usage:        acc.Usage,
			FinishReason: finishReason,
			ModelOptions: model.Options,
		}
		// Add reasoning if it exists
		reasoning := stream.builtReasoning.String()
		if reasoning != "" {
			messageParts.Reasoning = reasoning
		}
		if streamErr != nil {
			message.Set("status", MessageStatusFailed)
		} else {
			message.Set("status", MessageStatusCompleted)
		}

		message.Set("parts", messageParts)
		message.Set("meta", messageMeta)

		if err := s.PB.Save(message); err != nil {
			s.PB.Logger().Error("Failed to save message record", "messageID", stream.MessageID, "error", err)
			return
		}

		s.PB.Logger().Debug("Stream consume finished", "messageID", stream.MessageID)
	}()

	// Get user's api key from the database
	apiKeyRecord, err := s.PB.FindFirstRecordByData("api_keys", "owner_user_id", stream.UserID)
	if err != nil {
		s.PB.Logger().Error("Failed to find API key record", "userID", stream.UserID, "error", err)
		stream.addChunk("Error: Failed to find API key record", ChunkTypeError)
		streamErr = fmt.Errorf("no API key found for user %s: %w", stream.UserID, err)
		finishReason = FinishReasonError
		return
	}
	key := apiKeyRecord.GetString("key")
	if key == "" {
		s.PB.Logger().Error("API key not found or empty", "userID", stream.UserID)
		stream.addChunk("Error: API key not found or empty", ChunkTypeError)
		streamErr = fmt.Errorf("API key not found or empty")
		finishReason = FinishReasonError
		return
	}

	options := []option.RequestOption{
		option.WithAPIKey(key),
	}

	if stream.Model.Options != nil {
		if stream.Model.Options.WebSearch {
			// https://openrouter.ai/docs/features/web-search
			//"plugins": [{ "id": "web" }]
			searchOption := option.WithJSONSet("plugins", []map[string]string{
				{"id": "web"},
			})
			options = append(options, searchOption)
		}

		if stream.Model.Options.ReasoningEffort != nil {
			var reasoningOption option.RequestOption
			if *stream.Model.Options.ReasoningEffort == ReasoningEffortOff {
				reasoningOption = option.WithJSONSet("reasoning.max_tokens", 0)
			} else {
				reasoningOption = option.WithJSONSet("reasoning.effort", stream.Model.Options.ReasoningEffort)
			}
			options = append(options, reasoningOption)
		}
	}

	aiStream := s.aiClient.Chat.Completions.NewStreaming(stream.ctx, openai.ChatCompletionNewParams{
		Messages: stream.Transcript,
		Model:    stream.Model.ProviderID,
	}, options...)
	defer func(aiStream *ssestream.Stream[openai.ChatCompletionChunk]) {
		err := aiStream.Close()
		if err != nil {
			s.PB.Logger().Error("Failed to close AI stream", "error", err)
		} else {
			s.PB.Logger().Debug("AI stream closed successfully", "messageID", stream.MessageID)
		}
	}(aiStream)

	acc = openai.ChatCompletionAccumulator{}

	done := false

	for {
		if done {
			s.PB.Logger().Debug("Stream done", "messageID", stream.MessageID)
			break
		}
		select {
		case <-stream.ctx.Done():
			s.PB.Logger().Debug("Stream context cancelled", "messageID", stream.MessageID)
			stream.addChunk("", ChunkTypeError)
			streamErr = fmt.Errorf("stream cancelled")
			done = true
			finishReason = FinishReasonCancelled
			break
		default:
			if !aiStream.Next() {
				if err := aiStream.Err(); err != nil {
					stream.addChunk("Error: "+err.Error(), ChunkTypeError)
					streamErr = fmt.Errorf("stream error: %w", err)
					s.PB.Logger().Error("Stream error", "error", err)
					finishReason = FinishReasonError
				}
				s.PB.Logger().Debug("Stream completed", "messageID", stream.MessageID)
				done = true
				break
			}

			chunk := aiStream.Current()

			if len(chunk.Choices) > 0 {
				if chunk.Choices[0].FinishReason != "" {
					finishReason = FinishReason(chunk.Choices[0].FinishReason)
					s.PB.Logger().Debug("Chunk finish reason", "reason", finishReason, "chunkId", chunk.ID)
				}
			} else {
				s.PB.Logger().Debug("Chunk has no choices")
			}

			acc.AddChunk(chunk)
			if content, ok := acc.JustFinishedContent(); ok {
				s.PB.Logger().Debug("Content stream finished", "content", content)
				stream.addChunk(content, ChunkTypeContent)
			}
			if tool, ok := acc.JustFinishedToolCall(); ok {
				s.PB.Logger().Debug("Tool call stream finished", "id", tool.ID, "index", tool.Index, "name", tool.Name, "arguments", tool.Arguments)
				stream.addChunk(tool.Arguments, UnknownChunkType)
			}
			if refusal, ok := acc.JustFinishedRefusal(); ok {
				s.PB.Logger().Debug("Refusal stream finished", "refusal", refusal)
				stream.addChunk(refusal, ChunkTypeError)
			}

			if len(chunk.Choices) > 0 {
				// if reasoning chunk, we can add it to the stream
				reasoning := chunk.Choices[0].Delta.JSON.ExtraFields["reasoning"]
				reasoningValue := reasoning.Raw()
				if reasoningValue != "null" {
					var reasoningString string
					err := json.Unmarshal([]byte(reasoningValue), &reasoningString)
					if err == nil {
						stream.addChunk(reasoningString, ChunkTypeReasoning)
					}
				}
				content := chunk.Choices[0].Delta.Content
				if content != "" {
					stream.addChunk(content, ChunkTypeContent)
				}
			}
		}
	}

	stream.chunkMutex.Lock()
	stream.complete = true
	stream.chunkMutex.Unlock()

	s.PB.Logger().Debug("Stream completed", "messageID", stream.MessageID)
}

type ChunkType int

const (
	UnknownChunkType ChunkType = iota
	ChunkTypeContent
	ChunkTypeReasoning
	ChunkTypeError
	ChunkTypeFinishReason
)

type FinishReason string

const (
	FinishReasonUnknown      FinishReason = "unknown"
	FinishReasonStop         FinishReason = "stop"
	FinishReasonLength       FinishReason = "length"
	FinishReasonToolCall     FinishReason = "tool_call"
	FinishReasonFunctionCall FinishReason = "function_call"
	FinishReasonError        FinishReason = "error"
	FinishReasonCancelled    FinishReason = "cancelled"
)

func (fr FinishReason) String() string {
	return string(fr)
}

func (s *ActiveStream) addChunk(chunkContent string, chunkType ChunkType) {
	s.chunkMutex.Lock()
	chunk := Chunk{Type: chunkType, Content: chunkContent}

	s.chunks = append(s.chunks, chunk)
	if chunkType == ChunkTypeContent {
		s.builtContent.WriteString(chunkContent)
	}
	if chunkType == ChunkTypeReasoning {
		s.builtReasoning.WriteString(chunkContent)
	}
	s.chunkMutex.Unlock()

	s.subscriberMutex.Lock()
	for _, subscriber := range s.subscribers {
		select {
		case subscriber.Channel <- chunk:
		default:
			// If the channel is full, we can skip sending the chunk
			// or handle it as needed (e.g., log a warning)
		}
	}
	s.subscriberMutex.Unlock()
}

func (s *ActiveStream) Subscribe(subscriberID string) <-chan Chunk {
	s.subscriberMutex.Lock()
	defer s.subscriberMutex.Unlock()

	subscriberChan := make(chan Chunk, 100)

	subscriber := &StreamSubscriber{
		ID:      subscriberID,
		Channel: subscriberChan,
	}

	// Return historical chunks when subscribing itself
	s.subscribers[subscriberID] = subscriber
	go func() {
		chunks := make([]Chunk, 0)
		s.chunkMutex.Lock()
		if s.builtReasoning.Len() > 0 {
			chunks = append(chunks, Chunk{Type: ChunkTypeReasoning, Content: s.builtReasoning.String()})
		}
		if s.builtContent.Len() > 0 {
			chunks = append(chunks, Chunk{Type: ChunkTypeContent, Content: s.builtContent.String()})
		}
		completed := s.complete
		s.chunkMutex.Unlock()

		for _, chunk := range chunks {
			select {
			case subscriberChan <- chunk:
			default:
				// If the channel is full, we can skip sending the chunk
				// or handle it as needed (e.g., log a warning)
				return
			}
		}

		if completed {
			close(subscriberChan)
		}
	}()

	return subscriberChan
}

func (s *ActiveStream) Unsubscribe(subscriberID string) {
	s.subscriberMutex.Lock()
	defer s.subscriberMutex.Unlock()

	if subscriber, ok := s.subscribers[subscriberID]; ok {
		close(subscriber.Channel)
		delete(s.subscribers, subscriberID)
	}
}
