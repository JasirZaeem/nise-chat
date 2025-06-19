import type { FiberNode } from "@/lib/thread.ts";
import { Message } from "@/components/thread/message.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useRef, useState } from "react";
import { InPlaceEditor } from "@/components/thread/in-place-editor.tsx";
import {
	type RegenerateMessageInput,
	updateUserMessageInThread,
} from "@/lib/api.ts";
import { UserMessage } from "@/components/thread/user-message.tsx";
import {
	CheckIcon,
	Copy,
	LucideCheck,
	LucideChevronLeft,
	LucideChevronRight,
	LucideDelete,
	LucideEdit,
	LucideRefreshCcw,
} from "lucide-react";
import {
	getModelByProviderId,
	getModelDisplayNameById,
	InPlaceModelSelector,
	models,
} from "@/components/model-selector.tsx";

type TriggerMessageRegenerationFn = (
	messageId: string,
	data: RegenerateMessageInput,
) => void;

type FiberNodeProps = {
	fiberNode: FiberNode;
	switchActiveFiber: (fiberId: string) => void;
	siblingGroupCount: number;
	regenerateMessage: TriggerMessageRegenerationFn;
	/**
	 * The node that is the response to this message, i.e. the assistant's response. if this is a user message.
	 */
	assistantResponseNode?: FiberNode;
	threadId: string;
	readonly?: boolean;
};

export function ThreadFiberNode({
	fiberNode,
	switchActiveFiber,
	siblingGroupCount,
	assistantResponseNode,
	regenerateMessage,
	threadId,
	readonly,
}: FiberNodeProps) {
	const editTextareaRef = useRef<HTMLTextAreaElement>(null);
	const [editingMessage, setEditingMessage] = useState(false);

	return (
		<div className="group/node" id={`fiber-node-${fiberNode.message.id}`}>
			{editingMessage ? (
				<InPlaceEditor
					textareaRef={editTextareaRef}
					initialValue={fiberNode.message.parts?.content || ""}
					roleFor={fiberNode.message.role}
				/>
			) : (
				<ThreadFiberNodeContent
					message={fiberNode.message}
					threadId={threadId}
				/>
			)}
			<ThreadFiberActions
				readonly={readonly}
				fiberNode={fiberNode}
				indexInLevel={fiberNode.indexInLevel}
				siblingGroupCount={siblingGroupCount}
				shiftLeft={
					fiberNode.previousSiblingId
						? // biome-ignore lint/style/noNonNullAssertion: previousSiblingId is being checked
							() => switchActiveFiber(fiberNode.previousSiblingId!)
						: undefined
				}
				shiftRight={
					fiberNode.nextSiblingId
						? // biome-ignore lint/style/noNonNullAssertion: nextSiblingId is being checked
							() => switchActiveFiber(fiberNode.nextSiblingId!)
						: undefined
				}
				toggleEditing={() =>
					setEditingMessage((prevIsEditing) => !prevIsEditing)
				}
				isEditing={editingMessage}
				handleEditMessage={() => {
					if (editTextareaRef.current) {
						if (fiberNode.message.role === "assistant") {
							// Editing a generated message
							regenerateMessage(fiberNode.message.id, {
								content: editTextareaRef.current.value,
								responseModel: {
									providerId: fiberNode.message.model,
									options: fiberNode.message.meta?.modelOptions || {},
								},
							});
						} else {
							updateUserMessageInThread(
								fiberNode.message.id,
								editTextareaRef.current.value,
								{
									providerId:
										assistantResponseNode?.message.model ||
										models["openai/gpt-4.1-nano"].providerId,
									options:
										assistantResponseNode?.message?.meta?.modelOptions || {},
								},
							);
						}
						setEditingMessage(false);
					}
				}}
				regenerateMessage={regenerateMessage}
			/>
		</div>
	);
}

type ThreadFiberNodeContentProps = {
	message: FiberNode["message"];
	threadId: string;
};

function ThreadFiberNodeContent({
	message,
	threadId,
}: ThreadFiberNodeContentProps) {
	if (message.role === "user") {
		return <UserMessage message={message} />;
	}
	return <Message originalMessage={message} threadId={threadId} />;
}

type ThreadFiberActionsProps = {
	fiberNode: FiberNode;
	indexInLevel: number;
	siblingGroupCount: number;
	shiftLeft?: () => void;
	shiftRight?: () => void;
	toggleEditing: () => void;
	isEditing: boolean;
	handleEditMessage: () => void;
	regenerateMessage?: TriggerMessageRegenerationFn;
	readonly?: boolean;
};

function ThreadFiberActions({
	fiberNode,
	indexInLevel,
	siblingGroupCount,
	shiftLeft,
	shiftRight,
	toggleEditing,
	isEditing,
	handleEditMessage,
	regenerateMessage,
	readonly,
}: ThreadFiberActionsProps) {
	const isUserMessage = fiberNode.message.role === "user";
	const showRegenerateButton =
		fiberNode.message.role === "assistant" && regenerateMessage && !isEditing;

	const model = getModelByProviderId(fiberNode.message.model);
	const modelName = model
		? getModelDisplayNameById(model.id)
		: fiberNode.message.model;

	if (readonly) {
		return (
			<div
				className={`flex w-fit border-glass items-center gap-2 bg-glass-darker p-1 opacity-0 group-has-[.message-loading-indicator]/node:opacity-0 group-has-[.message-loading-indicator]/node:pointer-events-none group-last/node:opacity-100 group-hover/node:opacity-100 transition-none ${isUserMessage ? "ml-auto -mt-4" : "mt-2"}`}
			>
				<CopyButton textToCopy={fiberNode.message.parts?.content || ""} />
				{!isUserMessage ? (
					<span className="text-xs text-accent-foreground font-bold mr-2">
						{modelName}
					</span>
				) : null}
			</div>
		);
	}

	return (
		<div
			className={`flex w-fit border-glass items-center gap-2 bg-glass-darker p-1 opacity-0 group-has-[.message-loading-indicator]/node:opacity-0 group-has-[.message-loading-indicator]/node:pointer-events-none group-last/node:opacity-100 group-hover/node:opacity-100 transition-none ${isUserMessage ? "ml-auto -mt-4" : "mt-2"}`}
		>
			{(shiftLeft || shiftRight) && (
				<Button
					size="icon"
					variant="ghost"
					onClick={shiftLeft}
					disabled={!shiftLeft}
				>
					<LucideChevronLeft />
				</Button>
			)}
			{siblingGroupCount > 1 ? (
				<span>
					{indexInLevel + 1} / {siblingGroupCount}
				</span>
			) : null}
			{(shiftRight || shiftLeft) && (
				<Button
					size="icon"
					variant="ghost"
					onClick={shiftRight}
					disabled={!shiftRight}
				>
					<LucideChevronRight />
				</Button>
			)}

			{/* Only show edit button for user messages */}

			{isUserMessage && !isEditing ? (
				<CopyButton textToCopy={fiberNode.message.parts?.content || ""} />
			) : null}

			{isEditing ? (
				<>
					<Button onClick={handleEditMessage} size="icon" variant="ghost">
						<LucideCheck />
					</Button>
					<Button onClick={toggleEditing} size="icon" variant="ghost">
						<LucideDelete />
					</Button>
				</>
			) : (
				<Button onClick={toggleEditing} size="icon" variant="ghost">
					<LucideEdit />
				</Button>
			)}

			{showRegenerateButton ? (
				<CopyButton textToCopy={fiberNode.message.parts?.content || ""} />
			) : null}

			{showRegenerateButton ? (
				<RegenerateMessageButton
					messageId={fiberNode.message.id}
					lastResponseModel={fiberNode.message.model}
					handleRegenerate={(modelProviderId: string) => {
						// alert(modelProviderId);
						if (modelProviderId === fiberNode.message.model) {
							regenerateMessage(fiberNode.message.id, {
								responseModel: {
									providerId: modelProviderId,
									options: fiberNode.message.meta?.modelOptions || {},
								},
							});
							return;
						}

						regenerateMessage(fiberNode.message.id, {
							responseModel: {
								providerId: modelProviderId,
								options: {},
							},
						});
					}}
				/>
			) : null}

			{!isUserMessage ? (
				<span className="text-xs text-accent-foreground font-bold mr-2">
					{modelName}
				</span>
			) : null}
		</div>
	);
}

type RegenerateMessageButtonProps = {
	/**
	 * The ID of the message to regenerate.
	 */
	messageId: string;
	/**
	 * The model used to generate the original response.
	 */
	lastResponseModel: string;
	/**
	 * Callback to regenerate the message.
	 */
	handleRegenerate: (modelProviderId: string) => void;
};

function RegenerateMessageButton({
	lastResponseModel,
	handleRegenerate,
}: RegenerateMessageButtonProps) {
	return (
		<InPlaceModelSelector
			defaultModelProviderId={lastResponseModel}
			Trigger={
				<Button size="icon" variant="ghost">
					<LucideRefreshCcw />
				</Button>
			}
			onChange={handleRegenerate}
		/>
	);
}

type CopyButtonProps = {
	textToCopy: string;
};
// Button that copies text to clipboard and shows 500 ms of success state
export function CopyButton({ textToCopy }: CopyButtonProps) {
	const [copied, setCopied] = useState(false);
	const handleCopy = () => {
		navigator.clipboard.writeText(textToCopy).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 500);
		});
	};
	return (
		<Button
			size="icon"
			variant="ghost"
			onClick={handleCopy}
			disabled={copied}
			title={copied ? "Copied!" : "Copy to clipboard"}
			className={copied ? "bg-green-300 disabled:opacity-100" : ""}
		>
			{copied ? (
				<CheckIcon className="text-green-800 starting:scale-50 scale-100" />
			) : (
				<Copy className="text-inherit" />
			)}
		</Button>
	);
}
