import { pb } from "@/lib/pb.ts";
import { useActiveThreadStore } from "@/hooks/activeThreadStore.ts";
import { Button } from "@/components/ui/button.tsx";
import { ArrowUp } from "lucide-react";
import { type ChangeEvent, type CSSProperties, useState } from "react";
import { useNewMessage } from "@/hooks/use-new-message.tsx";
import { useNavigate } from "@tanstack/react-router";
import { models, ModelSelector } from "./model-selector";
import type { ResponseModel } from "@/lib/api.ts";
import { toast } from "sonner";

export function ChatInput() {
	const threadId = useActiveThreadStore((state) => state.threadTree?.thread.id);
	const { newMessageInThread, newThreadWithFirstMessage } = useNewMessage();
	const navigate = useNavigate();
	const [model, setModel] = useState<ResponseModel>({
		options: {},
		providerId: models["openai/gpt-4.1-nano"].providerId,
	});
	const [attachments, setAttachments] = useState<File[]>([]);

	return (
		<div className="chat-input-container z-10 bg-glass-accent text-foreground rounded-t-2xl border-t-8 border-l-8 border-r-8 border-b-none border-sidebar w-4xl max-w-3/4 mx-auto left-0 right-0 h-fit absolute bottom-0">
			<form
				className="border-2 border-muted chat-input-form rounded-xl outline-sidebar outline-6 pt-2 px-1 pb-1"
				onSubmit={async (e) => {
					e.preventDefault();
					try {
						const formData = new FormData(e.currentTarget);
						const message = formData.get("message")?.toString().trim();
						if (!message) return;

						const requestFormData = new FormData();
						// Add message, attachments, and model information to the request
						requestFormData.append("content", message);
						if (attachments.length > 0) {
							for (const file of attachments) {
								requestFormData.append("attachments", file);
							}
						}
						requestFormData.append("responseModel", JSON.stringify(model));

						const userId = pb.authStore.record?.id;
						if (!userId) {
							console.error("User is not authenticated");
							return;
						}

						if (!threadId) {
							const res = await newThreadWithFirstMessage(requestFormData);
							// Navigate to the new thread
							await navigate({
								to: "/thread/$threadId",
								params: {
									threadId: res.data.thread.id,
								},
							});
						} else {
							const activeMessage =
								useActiveThreadStore.getState().activeFiberTail;

							if (
								activeMessage?.message.status === "generating" ||
								activeMessage?.message.status === "pending"
							) {
								toast.info("Message is still generating, please wait.");
								return;
							}

							requestFormData.append(
								"parentMessageId",
								activeMessage?.messageId || "",
							);

							await newMessageInThread(requestFormData);
						}

						// Clear the textarea
						const textarea = document.getElementById(
							"chat-input-textarea",
						) as HTMLTextAreaElement;
						if (textarea) {
							textarea.value = "";
							textarea.style.height = "auto"; // Reset height to auto
							// Clear files
							setAttachments([]);
						}
					} catch (error) {
						toast.error(
							"Failed to send message, check console for errors. Please try again.",
						);
						console.error("Error sending message:", error);
					}
				}}
			>
				<ChatInputTextarea />
				{/* Controls */}
				{/* Row Reverse to tab navigate to send before model select */}
				<div className="flex items-center justify-between mt-2 flex-row-reverse">
					<div>
						<Button
							variant="accent"
							type="submit"
							size="icon"
							className="aspect-square p-0 m-0"
						>
							<ArrowUp className="w-10 h-10" size="48px" />
						</Button>
					</div>

					<ModelSelector
						value={model}
						setValue={setModel}
						attachments={attachments}
						setAttachments={setAttachments}
					/>
				</div>
			</form>
		</div>
	);
}

// Auto-growing textarea up to 8 rows
function ChatInputTextarea() {
	const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
		const content = document.getElementById("sidebar-content");
		if (!content) {
			return;
		}
		const textarea = e.target;
		textarea.style.height = "auto"; // Reset height to auto to calculate scrollHeight correctly
		const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight);
		const maxRows = 8;
		const maxHeight = lineHeight * maxRows;
		content.style.setProperty(
			"--chat-input-height",
			`${Math.min(textarea.scrollHeight, maxHeight)}px`,
		);
		textarea.style.height = "var(--chat-input-height)";
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault(); // Prevent default Enter behavior
			const form = e.currentTarget.form;
			if (form) {
				form.requestSubmit(); // Submit the form programmatically
			}
		}
	};

	return (
		<textarea
			name="message"
			onInput={handleInput}
			onKeyDown={handleKeyDown}
			id="chat-input-textarea"
			className="min-h-20 max-h-48 p-2 w-full rounded-md resize-none leading-6 overflow-y-auto border-none outline-none"
			style={
				{
					height: "var(--chat-input-height)",
				} as CSSProperties
			}
			rows={1}
		/>
	);
}
