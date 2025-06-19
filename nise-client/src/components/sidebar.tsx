import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";

import {
	CopyIcon,
	EllipsisVertical,
	Globe,
	LoaderCircle,
	MonitorOff,
	Plus,
	SearchIcon,
	ShareIcon,
	SidebarCloseIcon,
	TextCursor,
	Trash,
} from "lucide-react";
import { Link, useParams } from "@tanstack/react-router";
import { Button } from "@/components/ui/button.tsx";
import {
	type ComponentProps,
	type ComponentPropsWithoutRef,
	useEffect,
} from "react";
import { pb } from "@/lib/pb.ts";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { SidebarUser } from "@/components/sidebar-user.tsx";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu.tsx";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx";
import { CommandShortcut } from "./ui/command";
import { NiseIcon } from "@/components/nise-icon.tsx";

type AppSidebarProps = {
	logout: () => void;
	searchOpen: boolean;
	setSearchOpen: (isOpen: boolean) => void;
} & ComponentProps<typeof Sidebar>;

export function AppSidebar({
	logout,
	searchOpen,
	setSearchOpen,
	...props
}: AppSidebarProps) {
	const isMacOS: boolean = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

	const { toggleSidebar } = useSidebar();

	return (
		<Sidebar collapsible="offcanvas" className="group/sidebar z-20" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem className="flex items-center gap-2 justify-between">
						<Button
							type="button"
							size="icon"
							variant="ghost"
							onClick={() => toggleSidebar()}
						>
							<SidebarCloseIcon className="size-5" />
						</Button>
						<SidebarMenuButton
							asChild
							className="data-[slot=sidebar-menu-button]:!p-1.5 hover:bg-transparent"
						>
							<Link
								to="/"
								className="w-full flex justify-center items-center gap-2 mr-10"
							>
								<span className="size-6">
									<NiseIcon />
								</span>
								<span className="text-base w-fit font-semibold">
									Nise.<em className="text-accent-foreground">Chat</em>
								</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>

					<SidebarMenuItem className="w-full">
						<Button className="w-full mt-2" asChild variant="accent">
							<Link to="/">
								<Plus className="size-4" />
								New Chat
							</Link>
						</Button>
					</SidebarMenuItem>

					<SidebarMenuItem className="w-full">
						<Button
							className="w-full mt-2"
							variant="outline"
							onClick={() => setSearchOpen(true)}
						>
							<SearchIcon />
							Search
							<CommandShortcut>
								{isMacOS ? "⌘" : "CTRL"}
								+K
							</CommandShortcut>
						</Button>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavChats />
			</SidebarContent>
			<SidebarFooter>
				<SidebarUser />
			</SidebarFooter>
		</Sidebar>
	);
}

export function NavChats(props: ComponentPropsWithoutRef<typeof SidebarGroup>) {
	const queryClient = useQueryClient();
	const threadsQuery = useInfiniteQuery({
		queryKey: ["threads"],
		queryFn: async ({ pageParam = 1 }) => {
			return await pb.collection("threads").getList(pageParam, 10, {
				sort: "-created",
			});
		},
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			return lastPage.page + 1;
		},
		staleTime: 1000 * 60 * 5, // 5 minutes
	});

	useEffect(() => {
		pb.collection("threads").subscribe("*", (e) => {
			if (
				e.action === "create" ||
				e.action === "update" ||
				e.action === "delete"
			) {
				// Invalidate the query to refetch threads
				queryClient.invalidateQueries({ queryKey: ["threads"] });
			}
		});

		return () => {
			pb.collection("threads").unsubscribe("*");
		};
	}, [queryClient]);

	const { threadId: currentThreadId } = useParams({
		strict: false,
	});

	return (
		<SidebarGroup {...props}>
			<SidebarGroupContent>
				<SidebarMenu>
					{threadsQuery.data?.pages.map((page) => {
						return page.items.map((thread) => (
							<SidebarMenuItem key={thread.id}>
								<Dialog>
									<AlertDialog>
										<ContextMenu>
											<ContextMenuTrigger asChild>
												<SidebarMenuButton
													asChild
													isActive={thread.id === currentThreadId}
												>
													<Link
														to={"/thread/$threadId"}
														params={{ threadId: thread.id }}
														className="group/sidebar-thread line-clamp-1 overflow-hidden"
													>
														<span
															className={`truncate w-full${thread.title_generation_status === "generating" ? " mr-4" : ""}`}
														>
															{thread.title}
														</span>
														{thread.title_generation_status === "generating" ? (
															<div className="h-4 relative">
																<LoaderCircle className="animate-spin absolute right-0 h-4 w-4" />
															</div>
														) : null}
														{thread.shared ? <Globe /> : null}
														<EllipsisVertical className="absolute right-0 bg-sidebar-accent opacity-0 mr-1 group-hover/sidebar-thread:opacity-100" />
													</Link>
												</SidebarMenuButton>
											</ContextMenuTrigger>

											<ContextMenuContent>
												{!thread.shared ? (
													<ContextMenuItem
														onClick={() => {
															pb.collection("threads")
																.update(thread.id, {
																	shared: new Date().toISOString(),
																})
																.then(() => {
																	navigator.clipboard.writeText(
																		`${window.location.origin}/share/${thread.id}`,
																	);
																	toast.success(
																		"Thread shared and link copied",
																		{
																			position: "top-left",
																		},
																	);
																});
														}}
													>
														<ShareIcon />
														Share
													</ContextMenuItem>
												) : null}
												{thread.shared ? (
													<ContextMenuItem
														onClick={() => {
															navigator.clipboard.writeText(
																`${window.location.origin}/share/${thread.id}`,
															);
															toast.success("Share link copied to clipboard", {
																position: "top-left",
															});
														}}
													>
														<CopyIcon /> Copy Share Link
													</ContextMenuItem>
												) : null}
												{thread.shared ? (
													<ContextMenuItem
														onClick={() => {
															pb.collection("threads")
																.update(thread.id, {
																	shared: null,
																})
																.then(() => {
																	toast.success("Stopped sharing thread", {
																		position: "top-left",
																	});
																});
														}}
													>
														<MonitorOff /> Unshare
													</ContextMenuItem>
												) : null}

												<ContextMenuItem>
													<TextCursor />
													<DialogTrigger>Rename</DialogTrigger>
												</ContextMenuItem>

												<ContextMenuItem className="text-destructive">
													<Trash className="text-inherit" />
													<AlertDialogTrigger>Delete</AlertDialogTrigger>
												</ContextMenuItem>
											</ContextMenuContent>
										</ContextMenu>

										<DeleteThreadDialog thread={thread} />
										<EditThreadDialog thread={thread} />
									</AlertDialog>
								</Dialog>
							</SidebarMenuItem>
						));
					})}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

type EditThreadDialogProps = {
	thread: { id: string; title: string };
};

function EditThreadDialog({ thread }: EditThreadDialogProps) {
	return (
		<DialogContent>
			<DialogHeader className="flex flex-row items-center gap-2">
				<TextCursor />
				Edit Thread Title
			</DialogHeader>
			<DialogDescription>
				<form
					className="w-full"
					onSubmit={(e) => {
						e.preventDefault();
						const formData = new FormData(e.currentTarget);
						const newTitle = formData.get("title") as string;
						if (newTitle.trim() === "") {
							toast.error("Title cannot be empty");
							return;
						}
						pb.collection("threads")
							.update(thread.id, { title: newTitle })
							.then(() => {
								toast.success("Thread title updated", {
									position: "top-left",
								});
							})
							.catch((error) => {
								toast.error(`Error updating title: ${error.message}`);
							});
					}}
				>
					<Input type="text" name="title" defaultValue={thread.title} />
					<Button
						type="submit"
						variant="accent"
						className="mt-2 mx-auto inline-block"
					>
						Save
					</Button>
				</form>
			</DialogDescription>
		</DialogContent>
	);
}

type DeleteThreadDialogProps = {
	thread: { id: string };
};

function DeleteThreadDialog({ thread }: DeleteThreadDialogProps) {
	return (
		<AlertDialogContent>
			<AlertDialogHeader>
				<AlertDialogTitle className="flex items-center gap-2">
					<Trash className="text-destructive" />
					Delete Thread ?
				</AlertDialogTitle>
				<AlertDialogDescription>
					This action cannot be undone. This will permanently delete this thread
					and all its messages.
				</AlertDialogDescription>
			</AlertDialogHeader>
			<AlertDialogFooter>
				<AlertDialogCancel>Cancel</AlertDialogCancel>
				<AlertDialogAction
					onClick={() => {
						pb.collection("threads")
							.delete(thread.id)
							.catch((error) => {
								toast.error(`Error deleting thread: ${error.message}`);
							});
					}}
					asChild
				>
					<Button variant="destructive" className="text-foreground">
						Delete
					</Button>
				</AlertDialogAction>
			</AlertDialogFooter>
		</AlertDialogContent>
	);
}
