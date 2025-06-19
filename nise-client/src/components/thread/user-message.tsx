import type { Message } from "@/lib/message.ts";
import { FileIcon } from "lucide-react";

function messageAttachmentURL(messageId: string, attachment: string): string {
	return `/api/files/messages/${messageId}/${attachment}`;
}

type MessageProps = {
	message: Message;
};

type Attachment = {
	type: "image" | "file";
	url: string;
	name: string;
};

function fileOrImage(name: string): "image" | "file" {
	if (
		name.endsWith(".png") ||
		name.endsWith(".jpg") ||
		name.endsWith(".jpeg")
	) {
		return "image";
	}
	return "file";
}

export function UserMessage({ message }: MessageProps) {
	const attachments: Attachment[] = [];
	if (message.attachments) {
		for (const attachment of message.attachments) {
			let url: string;
			if (message.meta?.edited) {
				url = messageAttachmentURL(
					message.meta.originalMessageId || message.id,
					attachment,
				);
			} else {
				url = messageAttachmentURL(message.id, attachment);
			}
			attachments.push({
				type: fileOrImage(attachment),
				url,
				name: attachment,
			});
		}
	}

	return (
		<div className="prose message max-w-80% w-fit ml-auto">
			<div className="message-content p-4 bg-background rounded-lg">
				{message.parts?.content}
			</div>
			{/* Show thumbnails for attachments	*/}
			{attachments.length > 0 && (
				<div className="attachments flex flex-wrap mt-2 gap-2 justify-end not-prose">
					{attachments.map((attachment) => (
						<a
							key={attachment.name}
							href={attachment.url}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-block"
						>
							{attachment.type === "image" ? (
								<img
									src={attachment.url}
									alt={attachment.name}
									className="max-w-64 h-fit rounded"
								/>
							) : (
								<span className="file-attachment bg-muted p-4 rounded-md flex items-center gap-2">
									<span className="file-name">{attachment.name}</span>
									<span className="file-icon">
										<FileIcon />
									</span>
								</span>
							)}
						</a>
					))}
				</div>
			)}
		</div>
	);
}
