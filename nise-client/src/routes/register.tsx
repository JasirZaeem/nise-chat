import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useLayoutEffect } from "react";
import { NiseIcon } from "@/components/nise-icon.tsx";
import { RegisterForm } from "@/components/register-form.tsx";

type RegisterSearch = {
	redirect?: string;
};

export const Route = createFileRoute("/register")({
	validateSearch: (search: Record<string, unknown>): RegisterSearch => {
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
	const { state } = Route.useRouteContext({
		select: ({ auth }) => ({ state: auth.state }),
	});

	const search = Route.useSearch();
	useLayoutEffect(() => {
		if (state.status === "authenticated") {
			router.history.push(search.redirect || "/");
		}
	}, [state.status, search.redirect, router.history.push]);
	// pb.collection("users").create({
	// 	em,
	// });
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
				<RegisterForm />
			</div>
		</div>
	);
}
