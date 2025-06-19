import {
	createRootRouteWithContext,
	Outlet,
	useRouter,
} from "@tanstack/react-router";

import type { QueryClient } from "@tanstack/react-query";
import type { Auth } from "@/lib/auth.ts";
import { useEffect } from "react";
import { pb } from "@/lib/pb.ts";
import { Toaster } from "@/components/ui/sonner";

interface MyRouterContext {
	queryClient: QueryClient;
	auth: Auth;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	beforeLoad: ({ context }) => {
		const { auth } = context;
		auth.initFromPocketBase();
	},
	component: () => {
		const router = useRouter();
		const { token } = Route.useRouteContext({
			select: ({ auth }) => ({
				token:
					auth.state.status === "authenticated" ? auth.state.accessToken : null,
			}),
		});

		useEffect(() => {
			pb.authStore.onChange((newToken) => {
				if (token !== newToken) {
					router.invalidate();
				}
			});
		}, [router.invalidate, token]);

		return (
			<>
				<Outlet />
				<Toaster />
				{/*<TanStackRouterDevtools position="bottom-right" />*/}
				{/*<TanStackQueryLayout />*/}
			</>
		);
	},
});
