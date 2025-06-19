import { createFileRoute } from "@tanstack/react-router";
import { useThread } from "@/hooks/use-thread.ts";
import { Thread } from "@/components/thread/thread.tsx";
import { LoaderCircle } from "lucide-react";
import { type CSSProperties, useEffect } from "react";
import type { ThreadRouteSearch } from "@/routes/_app/thread/$threadId.tsx";

export const Route = createFileRoute("/share/$shareId")({
	component: RouteComponent,
	validateSearch: (search: Record<string, unknown>): ThreadRouteSearch => {
		return {
			follow: search.follow ? String(search.follow) : undefined,
		};
	},
});

function RouteComponent() {
	const { shareId: threadId } = Route.useParams();
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
		<div
			id="sidebar-content"
			style={
				{
					"--chat-input-height": "80px",
				} as CSSProperties
			}
			className="border-8 rounded-xl w-100vw h-100vh overflow-hidden border-sidebar absolute bg-secondary top-0 bottom-0 w-full text-primary transition-shadow duration-1000 inset-shadow-sm has-[.message-loading-indicator]:inset-shadow-accent-foreground has-[.message-loading-indicator]:delay-0 delay-1000"
		>
			<div className="absolute inset-0 overflow-y-scroll pt-8 pb-[calc(var(--chat-input-height)+var(--spacing)*32))]">
				<div className="mx-auto flex w-full max-w-3xl flex-col space-y-12 px-4">
					<div>
						{thread?.title ||
						thread?.title_generation_status === "generating" ? (
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
								readonly={true}
							/>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}
