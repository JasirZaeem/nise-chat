package main

import (
	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
	"github.com/pocketbase/pocketbase"
)

type Application struct {
	PB            *pocketbase.PocketBase
	AIClient      *openai.Client
	StreamService *StreamService
}

func NewApplication() *Application {
	pb := pocketbase.New()
	aiClient := openai.NewClient(
		option.WithBaseURL("https://openrouter.ai/api/v1"),
	)
	streamService := NewStreamService(pb, aiClient)
	return &Application{
		PB:            pb,
		AIClient:      &aiClient,
		StreamService: streamService,
	}
}
