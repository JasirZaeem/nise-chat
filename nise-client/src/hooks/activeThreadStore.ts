// Stores the current active chat thread (tree) for the user, new messages are added to this thread.
import { create } from "zustand";
import {
	createThreadTree,
	type FiberNode,
	getFiberByMarker,
	type ThreadTree,
} from "@/lib/thread.ts";
import type { Message, Thread } from "@/lib/message";

type ActiveThreadStoreState =
	| {
			threadTree: ThreadTree;
			activeFiber: FiberNode[];
			activeFiberTail: FiberNode;
	  }
	| {
			threadTree: null;
			activeFiber: null;
			activeFiberTail: null;
	  };

type ActiveThreadStoreActions = {
	initializeThreadTree: (
		thread: Thread,
		messages: Message[],
		markerMessageId?: string,
	) => void;
	resetThreadTree: () => void;
	switchActiveFiber: (markerMessageId: string) => void;
};

export type ActiveThreadStore = ActiveThreadStoreState &
	ActiveThreadStoreActions;

export const useActiveThreadStore = create<ActiveThreadStore>((set) => ({
	threadTree: null,
	activeFiber: null,
	activeFiberTail: null,
	initializeThreadTree: (
		thread: Thread,
		messages: Message[],
		markerMessageId?: string,
	) =>
		set(() => {
			const threadTree = createThreadTree(thread, messages);
			const activeFiber = getFiberByMarker(threadTree, markerMessageId);

			return {
				threadTree,
				activeFiber,
				activeFiberTail: activeFiber.at(-1),
			};
		}),
	resetThreadTree: () =>
		set(() => ({
			threadTree: null,
			activeFiber: null,
			activeFiberTail: null,
		})),
	switchActiveFiber: (markerMessageId: string) =>
		set((state) => {
			if (!state.threadTree) {
				console.warn("No thread tree initialized, cannot switch active fiber.");
				return state;
			}
			const activeFiber = getFiberByMarker(state.threadTree, markerMessageId);
			return {
				activeFiber,
				activeFiberTail: activeFiber.at(-1),
			};
		}),
}));
