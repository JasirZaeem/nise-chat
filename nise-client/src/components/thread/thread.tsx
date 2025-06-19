import type { RegenerateMessageInput } from "@/lib/api";
import type { FiberNode } from "@/lib/thread.ts";
import { ThreadFiberNode } from "@/components/thread/thread-fiber-node.tsx";
import { useEffect, useRef } from "react";

type ThreadProps = {
	rootFiberCount: number;
	activeFiber: FiberNode[];
	switchActiveFiber: (fiberId: string) => void;
	regenerateMessage: (
		messageId: string,
		input: RegenerateMessageInput,
	) => Promise<unknown>;
	threadId: string;
	markerMessageId?: string; // Optional prop to switch to a specific fiber by marker message ID
	readonly?: boolean; // Optional prop to make the thread read-only
};

export function Thread({
	rootFiberCount,
	activeFiber,
	switchActiveFiber,
	regenerateMessage,
	threadId,
	markerMessageId,
	readonly,
}: ThreadProps) {
	// When active fiber changes, scroll to the last message by user
	const lastUserMessageId = activeFiber.at(-2)?.message.id;
	const firstRenderRef = useRef(true);

	useEffect(() => {
		// Does not work in dev mode because of the double render
		let messageIdToScroll = lastUserMessageId;

		if (firstRenderRef.current) {
			firstRenderRef.current = false;
			if (markerMessageId) {
				messageIdToScroll = markerMessageId;
			}
		}

		const fiberNodeId = `fiber-node-${messageIdToScroll}`;
		const fiberNode = document.getElementById(fiberNodeId);
		fiberNode?.scrollIntoView({
			behavior: "instant",
			block: "start",
		});
	}, [lastUserMessageId, markerMessageId]);

	return (
		<div className="space-y-8" id="thread-nodes">
			{activeFiber?.map((fiberNode, index) => {
				return (
					<ThreadFiberNode
						key={fiberNode.message.id}
						fiberNode={fiberNode}
						switchActiveFiber={switchActiveFiber}
						siblingGroupCount={
							activeFiber[index - 1]?.childrenIds.length ?? rootFiberCount
						}
						threadId={threadId}
						assistantResponseNode={
							fiberNode.message.role === "user"
								? activeFiber[index + 1]
								: undefined
						}
						regenerateMessage={regenerateMessage}
						readonly={readonly}
					/>
				);
			})}
		</div>
	);
}
