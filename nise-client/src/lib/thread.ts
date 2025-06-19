// Chat thread is a tree structure of message where branches can occurr in replies to messages.
// To render it returns an array ot messages which is the linear fiber of the thread to render.
// Fibers are recognised with marker messages. A fiber will begin from root, and will end at the lastest message that is
// possible to reach via the marker message. Default marker message is the latest message in the thread.
// For any message with siblings, moving left or right will update the marker message to the left or right sibling and
// fiber will be updated.

import type { Message, Thread } from "./message";

//
// class Thread {
//   id: string;
//   title: string;
//
//   messages: Message[];
//
//   // Every iteration of the first message starts a new fiber.
//   fibers: [];
// }

export type ThreadTree = {
	thread: Thread;

	allFibers: Map<string, FiberNode>; // Maps message ID to the fiber node
	// Every iteration of the first message starts a new fiber, that's the first level
	rootFiberIds: string[]; // Array of fiber IDs that are the roots of the fibers in this thread

	latestMessageId?: string; // The latest message in the thread, used to determine the default fiber
};

export type FiberNode = {
	messageId: string;
	message: Message;
	parentId?: string; // ID of the parent message, if any

	indexInLevel: number; // Index of this fiber in its level
	childrenIds: string[]; // IDs of child messages in the fiber
	previousSiblingId?: string; // ID of the previous sibling in the same level
	nextSiblingId?: string; // ID of the next sibling in the same level
};

// class FiberNode {
//   messageId: string;
//   parentId?: string;
//
//   // Index of the message in the thread, used to find the message in the thread.
//   messageIndex: number;
//   children: FiberNode[];
//   siblings: FiberNode[];
// }

// Create the tree structure for a thread given all it's messages.
export function createThreadTree(
	thread: Thread,
	initialMessages: Message[],
): ThreadTree {
	const allFibers = new Map<string, FiberNode>();
	const rootFiberIds: string[] = [];

	const threadTree: ThreadTree = {
		thread,
		allFibers,
		rootFiberIds,
		latestMessageId: initialMessages.at(-1)?.id, // The latest message is the last one in the initial messages
	};

	for (const message of initialMessages) {
		addMessageToThreadTree(threadTree, message);
	}

	return threadTree;
}

export function addMessageToThreadTree(thread: ThreadTree, message: Message) {
	// If the id of this message is newer than the latest message in the thread, update the latest message ID
	// Should never be the case since the events should be chronological
	if (!thread.latestMessageId || message.id > thread.latestMessageId) {
		thread.latestMessageId = message.id;
	}
	const parentFiber = message.parentMessageId
		? thread.allFibers.get(message.parentMessageId)
		: undefined;

	// Create a fiber node for this message
	const fiberNode: FiberNode = {
		messageId: message.id,
		message,
		parentId: message.parentMessageId,
		indexInLevel: (parentFiber?.childrenIds ?? thread.rootFiberIds).length, // Index in the parent's children or root fibers
		childrenIds: [],
		previousSiblingId: (parentFiber?.childrenIds ?? thread.rootFiberIds).at(-1), // Last child of the parent is the previous sibling
		nextSiblingId: undefined,
	};

	// Add to map
	thread.allFibers.set(fiberNode.messageId, fiberNode);

	// Set this as the next sibling of the previous child in the parent's children
	if (fiberNode.previousSiblingId) {
		const previousSibling = thread.allFibers.get(fiberNode.previousSiblingId);
		if (previousSibling) {
			previousSibling.nextSiblingId = fiberNode.messageId;
		}
	}

	// Add this to parent, or thread root if no parent
	if (parentFiber) {
		parentFiber.childrenIds.push(fiberNode.messageId);
	} else {
		// This is a root fiber
		thread.rootFiberIds.push(fiberNode.messageId);
	}
}

// Get the canonical fiber containing the message with the given ID.
// Default marker message is the latest message in the thread.
// canonical fiber is the fiber that starts from the root and ends at the latest message that is descendant of the marker message.
export function getFiberByMarker(
	thread: ThreadTree,
	markerMessageId?: string,
): FiberNode[] {
	return getFiberToLatestDescendant(
		thread,
		markerMessageId ? thread.allFibers.get(markerMessageId) : undefined,
	);
}

// Get the list of fiber nodes from this node to the latest descendant
// The latest descendant is the last created message, is will have the lexicographically highest ID.
function getFiberToLatestDescendant(
	thread: ThreadTree,
	startNode?: FiberNode,
): FiberNode[] {
	const fiber: FiberNode[] = [];

	const latestDescendantId = startNode
		? findLatestDescendantId(thread, startNode)
		: thread.latestMessageId;
	const latestDescendantNode = thread.allFibers.get(latestDescendantId || "");
	if (!latestDescendantNode) {
		throw new Error(
			`Fiber node with ID ${startNode?.messageId} not found in thread`,
		);
	}

	// Path from latest descendant to start
	let currentNode: FiberNode | undefined = latestDescendantNode;
	while (currentNode) {
		fiber.push(currentNode);
		// Move to parent
		currentNode = thread.allFibers.get(currentNode.parentId ?? "");
	}

	// Reverse the fiber to have it from start to latest descendant
	fiber.reverse();
	return fiber;
}

function findLatestDescendantId(
	thread: ThreadTree,
	startNode: FiberNode,
): string {
	let latestDescendantId = startNode.messageId;

	for (const childId of startNode.childrenIds) {
		const childNode = thread.allFibers.get(childId);
		if (childNode) {
			const descendantId = findLatestDescendantId(thread, childNode);
			if (descendantId > latestDescendantId) {
				latestDescendantId = descendantId;
			}
		}
	}

	return latestDescendantId;
}
