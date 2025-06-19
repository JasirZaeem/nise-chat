import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { LoginForm } from "@/components/login-form.tsx";
import { useLayoutEffect } from "react";
import { NiseIcon } from "@/components/nise-icon.tsx";

type LoginSearch = {
	redirect?: string;
};

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>): LoginSearch => {
		// validate and parse the search params into a typed state
		return {
			redirect: (search.redirect as string) || undefined,
		};
	},
	component: RouteComponent,
	beforeLoad: ({ context, search }) => {
		const { auth } = context;
		// If the user is logged out, redirect them to the login page
		if (auth.state.status === "authenticated") {
			throw redirect({
				to: search.redirect ? search.redirect : "/",
			});
		}
	},
});

function RouteComponent() {
	const router = useRouter();
	const { login, state } = Route.useRouteContext({
		select: ({ auth }) => ({ login: auth.login, state: auth.state }),
	});

	const search = Route.useSearch();
	useLayoutEffect(() => {
		if (state.status === "authenticated") {
			router.history.push(search.redirect || "/");
		}
	}, [state.status, search.redirect, router.history.push]);

	return (
		<div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-6">
				<div className="flex items-center gap-2 self-center font-medium">
					<div className="text-primary-foreground flex size-6 items-center justify-center rounded-md">
						<NiseIcon />
					</div>
					<span>
						Nise<em>.Chat</em>
					</span>
				</div>

				<LoginForm login={login} />
			</div>
		</div>
	);
}
