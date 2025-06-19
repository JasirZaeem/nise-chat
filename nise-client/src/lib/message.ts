import type { ResponseModelOptions } from "@/lib/api.ts";

export type MessageParts = {
	content: string;
	reasoning?: string;
	error?: string; // Error message if the message generation failed
	// TODO: Update for toolcalls like web search, can a message have multiple parts?
};

export type MessageUsage = {
	completionTokens: number;
	promptTokens: number;
	totalTokens: number;
	completionTokensDetails?: {
		acceptedPredictionTokens?: number;
		audioTokens?: number;
		reasoningTokens?: number;
		rejectedPredictionTokens?: number;
	};
	promptTokensDetails?: {
		audioTokens?: number;
		cachedTokens?: number;
	};
};

export type MessageMeta = {
	edited?: boolean; // Indicates if the message has been edited by the user
	originalMessageId?: string; // ID of the original message if this is an edit
	// TODO: Type finishReason
	finishReason?: string; // Reason for the message generation finish (e.g., "stop", "length", etc.)
	usage?: MessageUsage; // Usage stats for the message
	modelOptions?: ResponseModelOptions; // Options used for the model
};

export type MessageRole = "user" | "assistant" | "system";

export type MessageStatus = "pending" | "generating" | "completed" | "failed";

export type Message = {
	id: string;
	parentMessageId?: string;
	role: MessageRole;
	model: string;

	parts?: MessageParts;

	status: MessageStatus;

	meta?: MessageMeta;
	attachments?: string[]; // Array of attachment IDs

	created: string;
	updated: string;
};

export type Thread = {
	id: string;
	title?: string;
	comment?: string;
	created: string;
	updated: string;
};
