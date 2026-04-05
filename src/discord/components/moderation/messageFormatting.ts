type ReplyContext = {
  referencedMessageID?: string | null;
  referencedAuthorID?: string | null;
  referencedAuthorUsername?: string | null;
  referencedContent?: string | null;
};

type AttachmentLike = {
  filename?: string | null;
  contentType?: string | null;
  url?: string | null;
};

type TranscriptLineInput = ReplyContext & {
  createdAt: number;
  authorUsername: string;
  content: string;
  attachments?: AttachmentLike[] | null;
};

export function formatReplySuffix(input: ReplyContext): string {
  if (!input.referencedMessageID) return "";

  return ` [reply to ${input.referencedAuthorUsername ?? "(unknown)"} (${input.referencedAuthorID ?? "unknown"}): ${input.referencedContent || "(no content)"}]`;
}

export function formatAttachmentsSuffix(attachments?: AttachmentLike[] | null): string {
  if (!attachments || attachments.length === 0) return "";

  const rendered = attachments.map((attachment) => {
    return attachment.filename?.trim() || "(sans nom)";
  });

  return ` [PJ: ${rendered.join(", ")}]`;
}

export function formatTranscriptLine(input: TranscriptLineInput): string {
  return `[${new Date(input.createdAt).toISOString()}] ${input.authorUsername}: ${input.content}${formatReplySuffix(input)}${formatAttachmentsSuffix(input.attachments)}`;
}
