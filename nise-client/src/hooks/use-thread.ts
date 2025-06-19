// Hook to handle the state of a chat thread
// Chat thread is a tree structure of message where branches can occurr in replies to messages.
// To render it returns an array ot messages which is the linear fiber of the thread to render.
// Fibers are recognised with marker messages. A fiber will begin from root, and will end at the lastest message that is
// possible to reach via the marker message. Default marker message is the latest message in the thread.
// For any message with siblings, moving left or right will update the marker message to the left or right sibling and
// fiber will be updated.

import { useActiveThreadStore } from "@/hooks/activeThreadStore.ts";
import { pb } from "@/lib/pb.ts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import {
	type RegenerateMessageInput,
	regenerateMessageInThread,
} from "@/lib/api.ts";
import { redirect, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import type {
	Message,
	MessageMeta,
	MessageParts,
	MessageRole,
	MessageStatus,
} from "@/lib/message";

export function useThread(threadId: string, markerMessageId?: string) {
	const initializeThreadTree = useActiveThreadStore(
		(state) => state.initializeThreadTree,
	);
	const resetThreadTree = useActiveThreadStore(
		(state) => state.resetThreadTree,
	);
	const activeFiber = useActiveThreadStore((state) => state.activeFiber);
	const switchActiveFiber = useActiveThreadStore(
		(state) => state.switchActiveFiber,
	);
	const threadTree = useActiveThreadStore((state) => state.threadTree);

	const queryClient = useQueryClient();
	const router = useRouter();
	if (!threadId) {
		redirect({
			to: "/",
		});
	}

	const { data, isError, error, isLoading } = useQuery({
		queryKey: ["thread", threadId],
		queryFn: async () => {
			const threadQueryPromise = pb.collection("threads").getOne(threadId);
			const threadMessagesPromise = pb.collection("messages").getFullList({
				sort: "id",
				filter: `parent_thread_id="${threadId}"`,
			});

			const [thread, messages] = await Promise.all([
				threadQueryPromise,
				threadMessagesPromise,
			]);
			return {
				thread,
				messages,
			};
		},
		staleTime: 1000 * 60 * 5, // 5 minutes, refreshed on new messages or from pb subscription
	});

	const regenerateMessage = useCallback(
		async (messageId: string, input: RegenerateMessageInput) => {
			const res = await regenerateMessageInThread(threadId, messageId, input);
			// Invalidate the thread query to refetch messages
			await queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
			return res;
		},
		[threadId, queryClient],
	);

	useEffect(() => {
		if (isLoading) {
			return;
		}
		if (!data?.thread || !data?.messages) {
			resetThreadTree();
			router.navigate({
				to: "/",
			});
			// toast.error("Thread not found");
			toast.error("Thread not found");
			return;
		}

		const appMessages: Message[] =
			data.messages.map(
				(message) =>
					({
						id: message.id,
						role: message.role as MessageRole,
						parts: message.parts as MessageParts,
						status: message.status as MessageStatus,
						meta: message.meta as MessageMeta,
						created: message.created,
						updated: message.updated,
						model: message.model,
						attachments: message.attachments,
						parentMessageId: message.parent_message_id,
					}) satisfies Message,
			) || [];

		initializeThreadTree(
			{
				id: threadId,
				created: data.thread.created,
				updated: data.thread.updated,
			},
			appMessages,
			markerMessageId,
		);

		let unsubscribeThread: (() => void) | undefined;
		pb.collection("threads")
			.subscribe(threadId, (e) => {
				if (e.action === "update") {
					// Update the thread properties
					queryClient.setQueryData(
						["thread", threadId],
						(oldData: typeof data) => ({
							...oldData,
							thread: {
								...oldData.thread,
								title: e.record.title,
								title_generation_status: e.record.title_generation_status,
							},
						}),
					);
				} else if (e.action === "delete") {
					// If the thread is deleted, reset the thread tree and navigate to home
					resetThreadTree();
					toast.info("Thread deleted");
					router.navigate({
						to: "/",
					});
				}
			})
			.then((unsubscribe) => {
				unsubscribeThread = unsubscribe;
			});

		let unsubscribeMessages: (() => void) | undefined;
		pb.collection("messages").subscribe("*", (e) => {
			if (
				e.action === "create" ||
				(e.action === "update" && e.record.parent_thread_id === threadId)
			) {
				queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
			}
		});

		return () => {
			// Cleanup the subscription
			unsubscribeThread?.();
			unsubscribeMessages?.();
			resetThreadTree();
		};
	}, [
		data,
		router.navigate,
		queryClient,
		threadId,
		initializeThreadTree,
		resetThreadTree,
		isLoading,
		markerMessageId,
	]);

	return {
		thread: data?.thread,
		threadTree,
		activeFiber,
		switchActiveFiber,
		regenerateMessage,
		isError,
		error,
	};
}
