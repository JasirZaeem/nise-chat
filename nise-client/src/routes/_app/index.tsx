import {createFileRoute} from '@tanstack/react-router'
import {useEffect} from "react";
import {useActiveThreadStore} from "@/hooks/activeThreadStore.ts";
import {Button} from "@/components/ui/button.tsx";

export const Route = createFileRoute("/_app/")({
	component: AppIndex,
});

const exampleQuestions = [
	"How does AI work?",
	"Are black holes real?",
	"Is 9.11 greater than 9.9?",
	"What is the meaning of life?",
	'How many Rs are in the word "strawberry"?',
];

function onExampleQuestionClick(question: string) {
	const ta = document.getElementById("chat-input-textarea");
	if (!(ta instanceof HTMLTextAreaElement)) {
		return;
	}
	ta.focus();
	ta.value = question;
}

function AppIndex() {
	const resetThreadTree = useActiveThreadStore(
		(state) => state.resetThreadTree,
	);

	useEffect(() => {
		resetThreadTree();
	}, [resetThreadTree]);

	return (
		<div className="flex mt-16 items-center text-left w-full mx-auto">
			<div className="prose dark:prose-invert w-full my-auto h-fit mx-auto inline-block">
				<h1>How can I help you?</h1>
				<ul className="list-none pl-0 mx-auto w-full">
					{exampleQuestions.map((question, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
						<li key={index} className="list-none pl-0 ml-0">
							<Button
								className="w-full justify-start"
								size="lg"
								variant="ghost"
								onClick={() => onExampleQuestionClick(question)}
							>
								{question}
							</Button>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
