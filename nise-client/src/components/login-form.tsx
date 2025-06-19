import { useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card.tsx";
import type { ClientResponseError } from "pocketbase";
import { FieldInfo } from "@/components/field-info.tsx";
import { Link } from "@tanstack/react-router";

type LoginFormProps = {
	login: (email: string, password: string) => Promise<void>;
};

export function LoginForm({ login }: LoginFormProps) {
	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value, formApi }) => {
			try {
				await login(value.email, value.password);
			} catch (error) {
				if ((error as ClientResponseError).status === 400) {
					// Handle bad request error
					console.error("Login failed: Bad request", error);
					// form.store
					formApi.setErrorMap({
						onSubmit: {
							form: "Invalid email or password. Please try again.",
							fields: {},
						},
					});
				}
			}
		},
	});

	return (
		<div className="flex flex-col gap-6">
			<Card>
				<CardHeader>
					<CardTitle>Login to your account</CardTitle>
					<CardDescription>
						Enter your email below to login to your account
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						<div className="flex flex-col gap-6">
							<div className="grid gap-3">
								<form.Field
									name={"email"}
									validators={{
										onChange: ({ value }) => {
											if (!value) {
												return "Email is required";
											}
											if (value.length < 3) {
												return "Email must be at least 3 characters long";
											}
										},
									}}
								>
									{(field) => (
										<>
											<Label
												htmlFor={field.name}
												className="flex flex-col items-start"
											>
												Email
												<Input
													id={field.name}
													type="email"
													placeholder="m@example.com"
													required
													name={field.name}
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
												/>
											</Label>
											<FieldInfo field={field} />
										</>
									)}
								</form.Field>
							</div>
							<div className="grid gap-3">
								<form.Field
									name={"password"}
									validators={{
										onChange: ({ value }) => {
											if (!value) {
												return "Password is required";
											}
											if (value.length < 8) {
												return "Password must be at least 8 characters long";
											}
										},
									}}
								>
									{(field) => (
										<>
											<Label
												htmlFor={field.name}
												className="flex flex-col items-start"
											>
												Password
												<Input
													id={field.name}
													type="password"
													required
													name={field.name}
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
												/>
											</Label>
											<FieldInfo field={field} />
										</>
									)}
								</form.Field>
							</div>
							{form.state.errorMap.onSubmit ? (
								<div className="text-destructive">
									{form.state.errorMap.onSubmit}
								</div>
							) : null}
							<form.Subscribe
								selector={(state) => [state.canSubmit, state.isSubmitting]}
							>
								{([canSubmit, isSubmitting]) => (
									<Button
										type="submit"
										className="w-full"
										disabled={!canSubmit}
									>
										{isSubmitting ? "Logging in..." : "Login"}
									</Button>
								)}
							</form.Subscribe>
						</div>
						<div className="mt-4 text-center text-sm">
							Don&apos;t have an account?{" "}
							<Link to="/register" className="underline underline-offset-4">
								Sign up
							</Link>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
