import {
	createFileRoute,
	useNavigate,
	useRouteContext,
} from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button.tsx";
import { RefreshCcw, Trash } from "lucide-react";
import { pb } from "@/lib/pb.ts";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useForm } from "@tanstack/react-form";
import type { ClientResponseError } from "pocketbase";
import { FieldInfo } from "@/components/field-info.tsx";

export const Route = createFileRoute("/_app/settings")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		// TODO: Fix width
		<div className="prose mx-auto">
			<h1>Settings</h1>
			<hr />
			<div className="space-y-8">
				<AccountSection />
				<hr className="opacity-50" />
				<APIKeySection />
			</div>
		</div>
	);
}

function AccountSection() {
	const { user, login } = useRouteContext({
		from: "__root__",
		select: ({ auth }) => ({
			user: auth.state.status === "authenticated" ? auth.state.user : null,
			login: auth.login,
		}),
	});
	const navigate = useNavigate({
		from: "/settings",
	});

	if (!user) {
		navigate({ to: "/login" });
		return null;
	}

	const form = useForm({
		defaultValues: {
			name: user.name || "",
			oldPassword: "",
			newPassword: "",
			passwordConfirm: "",
		},
		onSubmit: async ({ value, formApi }) => {
			try {
				await pb.collection("users").update(user.id, {
					// If name is new, update it
					...(value.name !== user.name ? { name: value.name } : {}),
					// Only update password if newPassword is provided
					...(value.newPassword
						? {
								oldPassword: value.oldPassword,
								password: value.newPassword,
								passwordConfirm: value.passwordConfirm,
							}
						: {}),
				});
				if (value.newPassword) {
					// Re-auth on password change
					await login(user.email, value.newPassword);
				}
				formApi.reset();
			} catch (error) {
				if ((error as ClientResponseError).status) {
					formApi.setErrorMap({
						onSubmit: {
							form: "Failed to update. Please try again.",
							fields: {
								oldPassword: (error as ClientResponseError).data?.data
									?.oldPassword
									? "Invalid old password"
									: undefined,
							},
						},
					});
				}
			}
		},
	});

	return (
		<SettingsSection title="Account" infoSection="Manage your account settings">
			<form
				className="flex flex-col gap-4 w-full"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field
					name={"name"}
					validators={{
						onChange: ({ value }) => {
							if (value.length > 200) {
								return "Name must be less than 200 characters";
							}
						},
					}}
				>
					{(field) => (
						<>
							<Label htmlFor={field.name} className="flex flex-col items-start">
								Name
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</Label>
							<FieldInfo field={field} />
						</>
					)}
				</form.Field>

				{/* Old and new password to change password	*/}
				<form.Field
					name={"oldPassword"}
					validators={{
						onChange: ({ value }) => {
							if (value && value.length < 8) {
								return "Password must be at least 8 characters long";
							}
						},
					}}
				>
					{(field) => (
						<>
							<Label htmlFor={field.name} className="flex flex-col items-start">
								Old Password
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									type="password"
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</Label>
							<FieldInfo field={field} />
						</>
					)}
				</form.Field>
				<form.Field
					name={"newPassword"}
					validators={{
						onChangeListenTo: ["oldPassword"],
						onChange: ({ value, fieldApi }) => {
							if (!value) {
								// Optional
								return;
							}
							const oldPasswordValue =
								fieldApi.form.getFieldValue("oldPassword");
							if (!oldPasswordValue) {
								return "Old password is required to change password";
							}
							if (oldPasswordValue === value) {
								return "New password must be different from old password";
							}
							if (value && value.length < 8) {
								return "Password must be at least 8 characters long";
							}
						},
					}}
				>
					{(field) => (
						<>
							<Label htmlFor={field.name} className="flex flex-col items-start">
								New Password
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									type="password"
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</Label>
							<FieldInfo field={field} />
						</>
					)}
				</form.Field>
				<form.Field
					name={"passwordConfirm"}
					validators={{
						onChangeListenTo: ["oldPassword", "newPassword"],
						onChange: ({ value, fieldApi }) => {
							const newPasswordValue =
								fieldApi.form.getFieldValue("newPassword");
							if (!value) {
								// Optional if new password is not set
								return newPasswordValue
									? "Confirmation is required"
									: undefined;
							}
							const oldPasswordValue =
								fieldApi.form.getFieldValue("oldPassword");
							if (!oldPasswordValue) {
								return "Old password is required to change password";
							}
							if (!newPasswordValue) {
								return "New password is required to confirm password";
							}
							if (oldPasswordValue === value) {
								return "New password must be different from old password";
							}
							if (newPasswordValue !== value) {
								return "New password and confirmation do not match";
							}
							if (value && value.length < 8) {
								return "Password must be at least 8 characters long";
							}
						},
					}}
				>
					{(field) => (
						<>
							<Label htmlFor={field.name} className="flex flex-col items-start">
								New Password
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									type="password"
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</Label>
							<FieldInfo field={field} />
						</>
					)}
				</form.Field>
				<form.Subscribe selector={(state) => state.errorMap.onSubmit}>
					{form.state.errorMap.onSubmit ? (
						<div className="text-destructive">
							{form.state.errorMap.onSubmit}
						</div>
					) : null}
				</form.Subscribe>
				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
				>
					{([canSubmit, isSubmitting]) => (
						<Button type="submit" className="w-full" disabled={!canSubmit}>
							{isSubmitting ? "Saving..." : "Save"}
						</Button>
					)}
				</form.Subscribe>
			</form>
		</SettingsSection>
	);
}

function APIKeySection() {
	const { refetch, data, isLoading } = useQuery({
		queryKey: ["api-keys"],
		queryFn: async () => {
			const keys = await pb.collection("api_keys").getFullList({
				sort: "created",
			});
			return keys.map((key) => key.id);
		},
		staleTime: Number.POSITIVE_INFINITY,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	useEffect(() => {
		pb.collection("api_keys").subscribe("*", (e) => {
			if (
				e.action === "create" ||
				e.action === "update" ||
				e.action === "delete"
			) {
				refetch();
			}
		});

		return () => {
			pb.collection("api_keys").unsubscribe("*");
		};
	}, [refetch]);

	return (
		<SettingsSection
			title="API Key"
			infoSection="Provide your OpenRouter API key to use Nise.Chat"
		>
			<div>
				{data?.map((keyId) => (
					<APIKeyInfo key={keyId} keyId={keyId} />
				))}
			</div>
			{/* Only one provider supported atm */}
			{!isLoading && data?.length !== undefined && data.length < 1 ? (
				<form
					onSubmit={async (e) => {
						e.preventDefault();
						const formData = new FormData(e.currentTarget);
						const apiKey = formData.get("api-key")?.toString().trim();
						try {
							await pb.collection("api_keys").create({
								key: apiKey,
								owner_user_id: pb.authStore.record?.id,
								provider: "openrouter",
							});
						} catch (error) {
							console.error("Failed to add API key:", error);
						}
					}}
				>
					<Label htmlFor="name" className="flex flex-col items-start">
						Key
						<Input
							name="api-key"
							type="password"
							placeholder="Enter your OpenRouter API key"
							className="w-full"
						/>
					</Label>
					<Button type="submit" className="mt-2">
						Add API Key
					</Button>
				</form>
			) : null}
		</SettingsSection>
	);
}

type APIKeyInfoProps = {
	keyId: string;
};

function APIKeyInfo({ keyId }: APIKeyInfoProps) {
	const { data, isLoading, refetch } = useQuery({
		queryKey: ["api-key-info", keyId],
		queryFn: async () => {
			const result = await pb.send(`/api/key/${keyId}/info`, {
				method: "GET",
			});

			return result.data as {
				label?: string;
				limit: number;
				usage?: number;
				limit_remaining: number;
				is_free_tier?: boolean;
				is_provisioning_key?: boolean;
			};
		},
		// enabled: false,
		staleTime: Number.POSITIVE_INFINITY,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		retry: 1,
	});

	const {
		label,
		limit,
		usage,
		limit_remaining,
		is_free_tier,
		is_provisioning_key,
	} = data || {};

	return (
		<div className="not-prose">
			<span className="flex items-center justify-between">
				<strong className="flex items-center">
					<img
						src="/logos/openrouter.svg"
						className="inline-block mr-2 invert"
						alt="OpenRouter Logo"
					/>
					OpenRouter
				</strong>
				<span className="space-x-2">
					<Button
						size="icon"
						onClick={() => {
							refetch();
						}}
						disabled={isLoading}
					>
						<RefreshCcw className={isLoading ? "animate-spin" : undefined} />
					</Button>
					{/*	Delete */}
					<Button
						size="icon"
						variant="destructive"
						onClick={async () => {
							try {
								await pb.collection("api_keys").delete(keyId);
							} catch (error) {
								console.error("Failed to delete API key:", error);
							}
						}}
					>
						<Trash />
					</Button>
				</span>
			</span>

			<div className="space-y-1 grid grid-cols-2 mt-4">
				<Badge variant="background">Label</Badge>{" "}
				{isLoading ? <Skeleton /> : label || "No label"}
				<Badge variant="background">Limit</Badge>{" "}
				{isLoading ? (
					<Skeleton />
				) : (
					limit || "No limit set (setting recommended)"
				)}
				<Badge variant="background">Usage</Badge>{" "}
				{isLoading ? <Skeleton /> : usage || "No usage data"}
				<Badge variant="background">Limit Remaining</Badge>{" "}
				{isLoading ? <Skeleton /> : (limit_remaining ?? "No limit")}
				<Badge variant="background">Free Tier</Badge>{" "}
				{isLoading ? <Skeleton /> : is_free_tier ? "Yes" : "No"}
				<Badge variant="background">Provisioning Key</Badge>{" "}
				{isLoading ? <Skeleton /> : is_provisioning_key ? "Yes" : "No"}
			</div>
		</div>
	);
}

type SettingsSectionProps = {
	title: string;
	infoSection?: ReactNode;
	children: ReactNode;
};

function SettingsSection({
	title,
	infoSection,
	children,
}: SettingsSectionProps) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
			<div className="flex flex-col items-start justify-start">
				<h2 className="text-lg font-semibold mt-0">{title}</h2>
				{infoSection && (
					<div className="text-sm text-muted-foreground">{infoSection}</div>
				)}
			</div>
			<div className="flex flex-col gap-4 w-full">{children}</div>
		</div>
	);
}
