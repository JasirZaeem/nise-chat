import { pb } from "@/lib/pb.ts";
import type {
	MessageMeta,
	MessageParts,
	MessageRole,
	MessageStatus,
} from "@/lib/message.ts";

export type NewMessageInput = {
	parentMessageId?: string;
	content: string;
	responseModel: ResponseModel;
};

export type ModelReasoningEffort = "off" | "low" | "medium" | "high";

export type ResponseModelOptions = {
	webSearch?: boolean; // Whether to enable web search
	reasoningEffort?: ModelReasoningEffort; // Reasoning effort level
};

export type ResponseModel = {
	providerId: string; // OpenRouter model ID
	options: ResponseModelOptions; // Options for the model
};

type NewThreadWithFirstMessageResult = {
	message: string;
	data: {
		thread: {
			id: string;
			created: string;
			updated: string;
		};
		responseMessage: {
			id: string;
			parentThreadId: string;
			parentMessageId?: string;
			role: MessageRole;
			model: string;
			status: MessageStatus;
			parts: MessageParts;
			meta: MessageMeta;
		};
	};
};

export async function newThreadWithFirstMessageFormData(input: FormData) {
	return await pb.send<NewThreadWithFirstMessageResult>("/api/threads", {
		method: "POST",
		body: input,
	});
}

export async function newMessageInThreadFormData(
	threadId: string,
	input: FormData,
) {
	return (await pb.send(`/api/threads/${threadId}/messages`, {
		method: "POST",
		body: input,
	})) as {
		userMessageId: string; // ID of the user message
		responseMessageId: string; // ID of the response message
	};
}

export type RegenerateMessageInput = {
	content?: string; // Optional content if editing a message
	responseModel: ResponseModel; // Optional model if changing the model
};

export async function regenerateMessageInThread(
	threadId: string,
	messageId: string,
	input: RegenerateMessageInput,
) {
	return await pb.send(
		`/api/threads/${threadId}/messages/${messageId}/regenerate`,
		{
			method: "POST",
			body: JSON.stringify({
				content: input?.content,
				responseModel: input.responseModel,
			} satisfies RegenerateMessageInput),
		},
	);
}

export type UpdateUserMessageHandler = (
	messageId: string,
	content: string,
	responseModel: ResponseModel,
) => Promise<unknown>;

export function updateUserMessageInThread(
	messageId: string,
	content: string,
	responseModel: ResponseModel,
) {
	return pb.send(`/api/messages/${messageId}`, {
		method: "PATCH",
		body: JSON.stringify({
			content,
			responseModel,
		}),
	});
}
