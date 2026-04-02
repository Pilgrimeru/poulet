type ReplyContext = {
  referencedMessageID?: string | null;
  referencedAuthorID?: string | null;
  referencedAuthorUsername?: string | null;
  referencedContent?: string | null;
};

type TranscriptLineInput = ReplyContext & {
  createdAt: number;
  authorUsername: string;
  content: string;
};

export function formatReplySuffix(input: ReplyContext): string {
  if (!input.referencedMessageID) return "";

  return ` [reply to ${input.referencedAuthorUsername ?? "(unknown)"} (${input.referencedAuthorID ?? "unknown"}): ${input.referencedContent || "(no content)"}]`;
}

export function formatTranscriptLine(input: TranscriptLineInput): string {
  return `[${new Date(input.createdAt).toISOString()}] ${input.authorUsername}: ${input.content}${formatReplySuffix(input)}`;
}
