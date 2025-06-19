import PocketBase from "pocketbase";
import type { TypedPocketBase } from "@/lib/pocketbase-types.ts";

export const pb = new PocketBase() as TypedPocketBase;
