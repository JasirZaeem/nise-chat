import { createFileRoute } from "@tanstack/react-router";
import { useThread } from "@/hooks/use-thread.ts";

import { Thread } from "@/components/thread/thread.tsx";
import { LoaderCircle } from "lucide-react";
import { useEffect } from "react";

export type ThreadRouteSearch = {
	follow?: string;
};

export const Route = createFileRoute("/_app/thread/$threadId")({
	component: ThreadRouteComponent,
	validateSearch: (search: Record<string, unknown>): ThreadRouteSearch => {
		return {
			follow: search.follow ? String(search.follow) : undefined,
		};
	},
});

function ThreadRouteComponent() {
	const { threadId } = Route.useParams();
	const { follow } = Route.useSearch();
	const {
		threadTree,
		thread,
		activeFiber,
		switchActiveFiber,
		regenerateMessage,
	} = useThread(threadId, follow);

	useEffect(() => {
		if (thread?.title) {
			document.title = `${thread.title} | Nise.Chat`;
		} else {
			document.title = "Thread | Nise.Chat";
		}
	}, [thread?.title]);

	return (
		<div>
			{thread?.title || thread?.title_generation_status === "generating" ? (
				<div className="fixed thread-title z-10 bg-radial-[at_0%_0%] flex gap-2 items-center justify-center from-accent to-accent/0 top-2 transition-all duration-200 ease-linear  left-2 group-has-data-[state=expanded]/sidebar-wrapper:left-[var(--sidebar-width)] py-2 px-4 rounded-xl outline-8 outline-background">
					<h3 className="text-accent-foreground font-normal text-xl">
						{thread?.title}
					</h3>
					{thread?.title_generation_status === "generating" ? (
						<LoaderCircle className="animate-spin right-0 size-6 text-accent-foreground" />
					) : null}
				</div>
			) : null}
			{activeFiber ? (
				<Thread
					rootFiberCount={threadTree?.rootFiberIds.length || 0}
					activeFiber={activeFiber}
					switchActiveFiber={switchActiveFiber}
					regenerateMessage={regenerateMessage}
					threadId={threadId}
					markerMessageId={follow}
					readonly={false}
				/>
			) : null}
		</div>
	);
}
