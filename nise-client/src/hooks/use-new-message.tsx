import { useCallback } from "react";
import {
	newMessageInThreadFormData as newMessageInThreadApi,
	newThreadWithFirstMessageFormData,
} from "@/lib/api.ts";
import { useActiveThreadStore } from "@/hooks/activeThreadStore.ts";
import { useQueryClient } from "@tanstack/react-query";

export function useNewMessage() {
	const queryClient = useQueryClient();
	const threadId = useActiveThreadStore((state) => state.threadTree?.thread.id);

	const newMessageInThread = useCallback(
		async (input: FormData) => {
			if (!threadId) {
				throw new Error("Thread ID is required");
			}
			const res = await newMessageInThreadApi(threadId, input);
			// Invalidate the thread query to refetch messages
			await queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
			return res;
		},
		[threadId, queryClient],
	);

	const newThreadWithFirstMessage = useCallback(async (input: FormData) => {
		const res = await newThreadWithFirstMessageFormData(input);
		// Invalidate the threads query to refetch threads
		await queryClient.invalidateQueries({ queryKey: ["threads"] });
		return res;
	}, []);

	return {
		newMessageInThread,
		newThreadWithFirstMessage,
	};
}
