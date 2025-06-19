import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import remainMath from "remark-math";
import "katex/dist/katex.min.css";
import { ShikiHighlighter, type ShikiHighlighterProps } from "react-shiki";
import { CopyButton } from "@/components/thread/thread-fiber-node.tsx";
import { type DetailedHTMLProps, type HTMLAttributes, memo } from "react";

type MessageMarkdownProps = {
	content: string;
};

export const MessageMarkdown = memo(function MessageMarkdown({
	content,
}: MessageMarkdownProps) {
	return (
		<div className="px-2 overflow-x-auto max-w-full prose-pre:p-0 space-y-4">
			<Markdown
				remarkPlugins={[remarkGfm, remainMath]}
				rehypePlugins={[rehypeKatex]}
				components={{
					// @ts-ignore
					code: Code,
				}}
			>
				{content}
			</Markdown>
		</div>
	);
});
//

const Code = memo(function Code({
	children,
	className,
	...rest
}: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>) {
	const match = /language-(\w+)/.exec(className || "");
	if (match) {
		return (
			<div
				className="rounded-sm overflow-hidden not-prose p-0 relative"
				{...rest}
			>
				<div className="bg-accent-foreground/60 absolute top-2 right-2 z-10 w-fit h-fit rounded-sm text-foreground">
					<CopyButton textToCopy={String(children)} />
				</div>
				<Highlighter language={match[1]} theme="github-dark-high-contrast">
					{String(children)}
				</Highlighter>
			</div>
		);
	}
	return (
		<code className={className} {...rest}>
			{children}
		</code>
	);
});
const Highlighter = memo(function Highlighter({
	language,
	className,
	addDefaultStyles = false,
	showLanguage = false,
	children,
	...props
}: ShikiHighlighterProps) {
	return (
		<ShikiHighlighter
			{...props}
			language={language}
			addDefaultStyles={true}
			showLanguage={showLanguage}
			showLineNumbers={true}
			className={className}
			delay={100}
			{...props}
		>
			{children}
		</ShikiHighlighter>
	);
});
