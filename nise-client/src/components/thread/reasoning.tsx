import Markdown from "react-markdown";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion.tsx";

type ReasoningProps = {
	reasoning?: string;
	isStreaming?: boolean;
};

// TODO: Consider having it automatically close when streaming is done
export function Reasoning({ reasoning, isStreaming }: ReasoningProps) {
	return (
		<div className="prose prose-sm message min-w-full rounded-md bg-muted px-4">
			<Accordion
				type="single"
				collapsible
				className="message-content rounded-md"
				defaultValue={isStreaming ? "reasoning" : undefined}
			>
				<AccordionItem value="reasoning">
					<AccordionTrigger>
						<strong>Reasoning</strong>
					</AccordionTrigger>
					<AccordionContent>
						<Markdown>{reasoning}</Markdown>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
}
