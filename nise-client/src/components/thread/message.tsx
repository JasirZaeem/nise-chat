import { Reasoning } from "@/components/thread/reasoning.tsx";
import { MessageMarkdown } from "@/components/message-markdown.tsx";
import { useEffect, useRef, useState } from "react";
import { pb } from "@/lib/pb.ts";
import { EventSourcePlus } from "event-source-plus";
import { Alert, AlertTitle } from "@/components/ui/alert.tsx";
import { AlertCircleIcon } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import { useQueryClient } from "@tanstack/react-query";
import type { Message as MessageType } from "@/lib/message.ts";

type MessageRef = {
	message: MessageType;
	lastChunkReceived: number;
};

enum StreamingChunkType {
	UNKNOWN = 0,
	CONTENT = 1,
	REASONING = 2,
	ERROR = 3,

	FINISH_REASON = 4,
}

type MessageProps = {
	originalMessage: MessageType;
	threadId: string;
};

// Memoize based on id, then updated, then content, in that order
// TODO: Messages are immutable (except during streaming) memoize based on update time when adding markdown rendering
export function Message({ originalMessage, threadId }: MessageProps) {
	const queryClient = useQueryClient();
	const messageRef = useRef<MessageRef>({
		message: originalMessage,
		lastChunkReceived: Date.parse(originalMessage.updated),
	});
	const [_, setLastChunkReceived] = useState(
		Date.parse(originalMessage.updated),
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Choosing to matching specifically relevant properties
	useEffect(() => {
		// Reset reference on prop change
		if (originalMessage.id !== messageRef.current.message.id) {
			// If the message ID has changed, update the reference
			messageRef.current.message = originalMessage;
			messageRef.current.lastChunkReceived = Date.parse(
				originalMessage.updated,
			);
		}

		const message = messageRef.current.message;

		if (message.status !== "generating") {
			// If the message is not generating, no need to set up streaming
			return;
		}

		if (!message.parts) {
			message.parts = {
				content: "",
			};
		}

		// Reasoning would be undefined, initialize it
		if (message.parts.reasoning === undefined) {
			message.parts.reasoning = "";
		}

		// Acquire auth token
		const token = pb.authStore.token;
		if (!token) {
			console.error("No authentication token found");
			return;
		}

		// Subscribe to streaming updates for the message
		const streamEventSource = new EventSourcePlus(
			`/api/messages/${message.id}/stream`,
			{
				maxRetryCount: 1,
				retryStrategy: "on-error",
				headers: {
					Authorization: token,
				},
			},
		);

		// Start streaming the message
		const eventSourceController = streamEventSource.listen({
			onMessage(event) {
				const data = JSON.parse(event.data);
				// Add better typing, possibly validation
				if (data.t === StreamingChunkType.CONTENT) {
					// biome-ignore lint/style/noNonNullAssertion: Initialised above
					messageRef.current.message.parts!.content += data.c;
				} else if (data.t === StreamingChunkType.REASONING) {
					// biome-ignore lint/style/noNonNullAssertion: Initialised above
					messageRef.current.message.parts!.reasoning += data.c;
				} else if (data.t === StreamingChunkType.ERROR) {
					console.error("Error in streaming message:", data.c);
					// biome-ignore lint/style/noNonNullAssertion: Initialised above
					messageRef.current.message.parts!.error = data.c;
				} else if (data.t === StreamingChunkType.FINISH_REASON) {
					message.meta = {
						...message.meta,
						finishReason: data.c || "unknown",
					};
					// eventSourceController.abort();
					messageRef.current.message.status =
						data.c === "stop" ? "completed" : "failed";
				} else {
					console.warn("Unknown chunk type received:", data.t);
				}
				// TODO: Handle usage
				// TODO: Handle data chunks
				messageRef.current.lastChunkReceived = Date.now();
			},
		});

		eventSourceController.onAbort(() => {
			// Re-render if any events were received between the last render and the abort
			setLastChunkReceived((prev) => {
				if (messageRef.current.lastChunkReceived > prev) {
					return messageRef.current.lastChunkReceived;
				}
				return prev;
			});
			clearInterval(renderPollInterval);
			messageRef.current.lastChunkReceived = Date.now();
			// TODO: Handle error state and completion state

			// messageRef.current.message.status = "completed";
			if (messageRef.current.message.meta?.finishReason) {
				if (messageRef.current.message.meta.finishReason === "stop") {
					messageRef.current.message.status = "completed";
				} else {
					messageRef.current.message.status = "failed";
				}
			}

			queryClient.invalidateQueries({
				queryKey: ["thread", threadId],
			});
		});

		const renderPollInterval = setInterval(() => {
			// Update the last chunk received time
			setLastChunkReceived(messageRef.current.lastChunkReceived);
			// If the message has been updated, re-render
			setLastChunkReceived((prev) => {
				if (messageRef.current.lastChunkReceived > prev) {
					return messageRef.current.lastChunkReceived;
				}
				// Bail out if no new chunks have been received
				return prev;
			});
		}, 50);

		return () => {
			// Cleanup the event source and interval on unmount
			eventSourceController.abort();
			clearInterval(renderPollInterval);
		};
	}, [originalMessage.id, originalMessage.updated]);

	const message = messageRef.current.message;
	// TODO: Handle errors in message generation

	return (
		<>
			<div className="prose message min-w-full">
				<div className="message-content">
					{originalMessage.parts?.reasoning ? (
						<Reasoning
							reasoning={message.parts?.reasoning || ""}
							isStreaming={message.status === "generating"}
						/>
					) : null}
					<MessageMarkdown content={message.parts?.content || ""} />
				</div>
				{message.status === "failed" ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<Alert variant="destructive" className="w-fit">
								<AlertCircleIcon />
								<AlertTitle>Error generating response</AlertTitle>
							</Alert>
						</TooltipTrigger>
						<TooltipContent>
							<pre className="wrap-break-word text-destructive max-w-[60vw] sm:max-w-[80vw] flex-wrap overflow-x-auto p-1">
								{message.parts?.error}
							</pre>
						</TooltipContent>
					</Tooltip>
				) : null}
				{/*show loading state, global state for the teal underflow idea, zustand setter here and subscriber in effect div */}
				{message.status === "generating" ? <LoadingIndicator /> : null}
			</div>
		</>
	);
}

// Loading indicator is three bobbing dots with offset animation
function LoadingIndicator() {
	return (
		<div className="message-loading-indicator flex items-center justify-center space-x-2 mb-4">
			<div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-100" />
			<div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-200" />
			<div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-300" />
		</div>
	);
}
