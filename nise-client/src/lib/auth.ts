import { pb } from "@/lib/pb.ts";
import { createRouter } from "@tanstack/react-router";

export type User = {
	id: string;
	email: string;
	name?: string;
	avatarUrl?: string;
};

type AuthState =
	| {
			status: "loading";
	  }
	| {
			status: "unauthenticated";
	  }
	| {
			status: "authenticated";
			accessToken: string;
			user: User;
	  };

export type Auth = {
	/**
	 * @throws import("pocketbase").ClientResponseError if login fails
	 * @param email
	 * @param password
	 */
	login: (email: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
	initFromPocketBase: () => void;
	state: AuthState;
};

export const auth: Auth = {
	state: {
		status: "unauthenticated",
	},

	login: async (email, password) => {
		// Simulate a login process
		const res = await pb.collection("users").authWithPassword(email, password);
		auth.state = {
			status: "authenticated",
			accessToken: res.token,
			user: {
				id: res.record.id,
				email: res.record.email,
				name: res.record.name || email.split("@")[0], // Use the name from the record or derive from email
				avatarUrl: res.record.avatar, // Assuming avatarUrl is part of the user record
			},
		};
		const router = createRouter({});
		router.invalidate(); // Invalidate the router to trigger a re-render
	},
	logout: async () => {
		pb.authStore.clear(); // Clear the auth store
		auth.state = {
			status: "unauthenticated",
		};
	},

	initFromPocketBase: () => {
		if (pb.authStore.isValid) {
			if (!pb.authStore.record) {
				throw new Error("No user record found in auth store");
			}
			auth.state = {
				status: "authenticated",
				accessToken: pb.authStore.token,
				user: {
					id: pb.authStore.record.id,
					email: pb.authStore.record.email,
					name: pb.authStore.record.name,
					avatarUrl: pb.authStore.record.avatar,
				},
			};
		} else {
			auth.state = {
				status: "unauthenticated",
			};
		}
	},
};
