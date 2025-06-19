import {
	SidebarInset,
	SidebarProvider,
	useSidebar,
} from "@/components/ui/sidebar";
import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { AppSidebar } from "@/components/sidebar.tsx";
import { ChatInput } from "@/components/chat-input.tsx";
import { type CSSProperties, useEffect, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { PlusIcon, SearchIcon, SidebarOpenIcon } from "lucide-react";
import { SearchDialog } from "@/components/search-dialog.tsx";

export const Route = createFileRoute("/_app")({
	component: AppRouteComponent,
	beforeLoad: ({ context, location }) => {
		const { auth } = context;
		// If the user is logged out, redirect them to the login page
		if (auth.state.status === "unauthenticated") {
			throw redirect({
				to: "/login",
				search: {
					redirect: location.href,
				},
			});
		}
	},
});

function AppRouteComponent() {
	return (
		<SidebarProvider>
			<AppSidebarComponent />
		</SidebarProvider>
	);
}

function AppSidebarComponent() {
	const router = useRouter();
	const { logout, state } = Route.useRouteContext({
		select: ({ auth }) => ({
			logout: auth.logout,
			state: auth.state,
		}),
	});
	const [searchOpen, setSearchOpen] = useState(false);
	const { toggleSidebar } = useSidebar();

	if (state.status !== "authenticated") {
		redirect({
			to: "/login",
			search: {
				redirect: window.location.href,
			},
		});
		return null;
	}

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				setSearchOpen((prev) => !prev);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, []);

	return (
		<>
			<AppSidebar
				variant="inset"
				searchOpen={searchOpen}
				setSearchOpen={setSearchOpen}
				logout={() => {
					logout();
					router.invalidate();
				}}
			/>
			<SearchDialog isOpen={searchOpen} setIsOpen={setSearchOpen} />
			<div className="bg-glass border-glass w-fit mt-20 flex gap-2 absolute left-4 z-10 p-1">
				<Button
					size="icon"
					type="button"
					variant="ghost"
					onClick={() => toggleSidebar()}
				>
					<SidebarOpenIcon className="size-5" />
				</Button>
				<Button
					size="icon"
					type="button"
					variant="ghost"
					onClick={() => setSearchOpen(true)}
				>
					<SearchIcon className="size-5" />
				</Button>
				<Button size="icon" asChild type="button" variant="ghost">
					<Link to="/">
						<PlusIcon className="size-5" />
					</Link>
				</Button>
			</div>
			<SidebarInset>
				<div
					id="sidebar-content"
					style={
						{
							"--chat-input-height": "80px",
						} as CSSProperties
					}
					className="absolute bg-secondary top-0 bottom-0 w-full text-primary transition-shadow duration-1000 inset-shadow-sm has-[.message-loading-indicator]:inset-shadow-accent-foreground has-[.message-loading-indicator]:delay-0 delay-1000"
				>
					{/* Quick actions */}

					<div
						className="absolute inset-0 overflow-y-scroll pt-8 pb-[calc(var(--chat-input-height)+var(--spacing)*32))]"
						id="app-content-wrapper"
					>
						<div
							className="mx-auto flex w-full max-w-3xl flex-col space-y-12 px-4"
							id="app-content"
						>
							<Outlet />
						</div>
					</div>
					{/* Input */}
					<ChatInput />
				</div>
			</SidebarInset>
		</>
	);
}
