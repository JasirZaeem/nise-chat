import { BadgeCheck, ChevronsUpDown, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { Link, useRouteContext, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { UnsubscribeFunc } from "pocketbase";
import { pb } from "@/lib/pb.ts";
import type { User } from "@/lib/auth.ts";

export function SidebarUser() {
	const { isMobile } = useSidebar();
	const router = useRouter();
	const { auth } = useRouteContext({
		from: "__root__",
		select: ({ auth }) => ({ auth }),
	});

	const [user, setUser] = useState<User | null>(() =>
		auth.state.status === "authenticated" ? auth.state.user : null,
	);

	if (!user) {
		return null; // Don't render the user menu if not authenticated
	}

	let userName = "No name";
	let userInitials = "?";
	if (user.name) {
		userName = user.name;
		const firstSpaceIndex = user.name.indexOf(" ");
		userInitials = user.name.substring(0, 1).toUpperCase();
		if (firstSpaceIndex !== -1) {
			userInitials += user.name
				.substring(firstSpaceIndex + 1, firstSpaceIndex + 2)
				.toUpperCase();
		}
	}
	const userEmail = user.email || "No email";

	useEffect(() => {
		let unsubscribe: UnsubscribeFunc;
		pb.collection("users")
			.subscribe(user.id, (e) => {
				if (e.action === "update") {
					// Update the user data in the auth state
					setUser((prevUser) => {
						if (prevUser) {
							return {
								...prevUser,
								name: e.record.name || prevUser.name,
								email: e.record.email || prevUser.email,
								avatarUrl: e.record.avatar || prevUser.avatarUrl,
							};
						}
						return null;
					});
					router.invalidate();
				}
			})
			.then((unsub) => {
				unsubscribe = unsub;
			});

		return () => {
			unsubscribe?.();
		};
	}, [user, router]);

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<Avatar className="h-8 w-8 rounded-lg">
								{/*<AvatarImage src={user.avatar} alt={userName} />*/}
								<AvatarFallback className="rounded-lg">
									{userInitials}
								</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">{userName}</span>
								<span className="truncate text-xs">{userEmail}</span>
							</div>
							<ChevronsUpDown className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuLabel className="p-0 font-normal">
							<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
								<Avatar className="h-8 w-8 rounded-lg">
									{/*<AvatarImage src={user.avatar} alt={userName} />*/}
									<AvatarFallback className="rounded-lg">
										{userInitials}
									</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-medium">{userName}</span>
									<span className="truncate text-xs">{userEmail}</span>
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem asChild>
								<Link to="/settings">
									<BadgeCheck />
									Account
								</Link>
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={auth.logout}>
							<LogOut />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
