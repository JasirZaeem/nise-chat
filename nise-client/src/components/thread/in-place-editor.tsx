import { Textarea } from "@/components/ui/textarea.tsx";
import { type ChangeEvent, type RefObject, useEffect } from "react";
import type { MessageRole } from "@/lib/message.ts";

type InPlaceEditorProps = {
	textareaRef: RefObject<HTMLTextAreaElement | null>;
	initialValue: string;
	roleFor: Omit<MessageRole, "system">;
};

export function InPlaceEditor({
	textareaRef,
	initialValue,
	roleFor,
}: InPlaceEditorProps) {
	useEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		textarea.style.height = "auto"; // Reset to shrink if needed
		textarea.style.height = `${textarea.scrollHeight}px`;
		textarea.style.maxHeight = `${textarea.scrollHeight}px`; // Limit to max height
	}, [textareaRef.current]);

	const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
		const textarea = e.target;
		textarea.style.height = "auto"; // Reset to shrink if needed
		textarea.style.height = `${textarea.scrollHeight}px`;
	};

	return (
		<div
			className={`border-2 rounded-lg border-background ${roleFor === "user" ? "max-w-[80%] ml-auto" : ""}`}
		>
			<Textarea
				onInput={handleInput}
				className="py-5 text-base md:text-base min-w-full"
				ref={textareaRef}
				defaultValue={initialValue}
				rows={1}
			/>
		</div>
	);
}
