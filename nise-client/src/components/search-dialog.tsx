import { useDebouncedState } from "@/hooks/use-debounced-state";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "./ui/command";
import { pb } from "@/lib/pb.ts";
import { List, ListTree, LoaderCircle } from "lucide-react";

type ThreadSearchResult = {
	id: string;
	title: string;
	messages: { id: string; preview: string }[];
};

type SearchDialogProps = {
	isOpen: boolean;
	setIsOpen: (isOpen: boolean) => void;
};

export function SearchDialog({ isOpen, setIsOpen }: SearchDialogProps) {
	const { state: searchQuery, setState: setSearchQuery } = useDebouncedState(
		"",
		500,
	);

	const { data: threads = [], isLoading: areThreadsLoading } = useQuery({
		queryKey: ["threadSearch", searchQuery],
		queryFn: async () => {
			if (!searchQuery.trim()) return [];
			return (
				await pb.send("api/threads/search", {
					query: {
						query: searchQuery,
					},
				})
			).threads as ThreadSearchResult[];
		},
		enabled: !!searchQuery.trim(),
		staleTime: 1000 * 60 * 5, // 5 minutes
	});

	const navigate = useNavigate();

	const afterSelect = () => {
		setIsOpen(false);
		setSearchQuery(""); // Clear search query after selecting
	};
	return (
		<CommandDialog
			open={isOpen}
			onOpenChange={setIsOpen}
			className="max-h-[70vh] overflow-hidden"
		>
			<CommandInput
				defaultValue={searchQuery}
				placeholder="Search messages..."
				onValueChange={setSearchQuery}
			/>
			<CommandList>
				<CommandEmpty>No results found.</CommandEmpty>
				{areThreadsLoading ? (
					<CommandItem disabled>
						<LoaderCircle className="animate-spin size-4" />
						Loading threads...
					</CommandItem>
				) : null}

				{threads.length
					? threads.map((thread) => {
							return (
								<ThreadResultCommandItem
									key={thread.id}
									thread={thread}
									navigate={navigate}
									afterSelect={afterSelect}
								/>
							);
						})
					: null}
			</CommandList>
		</CommandDialog>
	);
}

type ThreadResultCommandItemProps = {
	thread: ThreadSearchResult;
	navigate: ReturnType<typeof useNavigate>;
	afterSelect: () => void;
};

function ThreadResultCommandItem({
	thread,
	navigate,
	afterSelect,
}: ThreadResultCommandItemProps) {
	return (
		<>
			<CommandItem
				value={thread.id}
				onSelect={(threadId) => {
					navigate({
						to: "/thread/$threadId",
						params: { threadId },
					});
					afterSelect();
				}}
			>
				<List />
				{thread.title}
				{thread.messages.length ? (
					<span className="text-muted-foreground text-xs ml-2">
						in {thread.messages.length} message
						{thread.messages.length !== 1 ? "s" : ""}
					</span>
				) : null}
			</CommandItem>

			{thread.messages.length > 0 ? (
				<CommandGroup>
					{thread.messages.map((message) => (
						<CommandItem
							key={message.id}
							value={message.id}
							onSelect={() => {
								navigate({
									to: "/thread/$threadId",
									params: {
										threadId: thread.id,
									},
									search: {
										follow: message.id,
									},
								});
								afterSelect();
							}}
							className="truncate max-w-full"
						>
							<ListTree /> {message.preview || "No preview available"}
						</CommandItem>
					))}
				</CommandGroup>
			) : null}
		</>
	);
}
