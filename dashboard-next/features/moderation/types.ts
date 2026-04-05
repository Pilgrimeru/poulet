"use client";

export type Tab = "appeals" | "sanctions" | "reports" | "flags";
export type Severity = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "UNFORGIVABLE";
export type SanctionType = "WARN" | "MUTE" | "BAN_PENDING";
export type SanctionNature = "Extremism" | "Violence" | "Hate" | "Harassment" | "Spam" | "Manipulation" | "Recidivism" | "Other";
export type SanctionState = "created" | "canceled";
export type AppealStatus = "pending_review" | "upheld" | "overturned";
export type ModerationReportStatus =
  | "awaiting_ai"
  | "awaiting_reporter"
  | "awaiting_confirmation"
  | "needs_followup"
  | "ready"
  | "sanctioned"
  | "dismissed";
export type FlaggedMessageStatus = "pending" | "analyzed" | "dismissed" | "escalated" | "needs_certification" | "sanctioned";

export type UserMeta = {
  userID: string;
  username: string;
  displayName: string;
  avatarURL: string;
};

export type SanctionItem = {
  id: string;
  guildID: string;
  userID: string;
  moderatorID: string;
  type: SanctionType;
  severity: Severity;
  nature: SanctionNature;
  state: SanctionState;
  reason: string;
  durationMs: number | null;
  createdAt: number;
};

export type AppealItem = {
  id: string;
  sanctionID: string;
  text: string;
  status: AppealStatus;
  reviewOutcome: "upheld" | "overturned" | "modified" | "sanctioned_bad_faith" | null;
  resolutionReason: string | null;
  revisedSanction: SanctionDraft | null;
  reviewedAt: number | null;
  createdAt: number;
};

export type FlagAnalysis = {
  isViolation?: boolean;
  severity?: Severity;
  reason?: string;
  nature?: SanctionNature;
  victimUserID?: string | null;
  needsMoreContext?: boolean;
  sanctionKind?: SanctionType | null;
  similarSanctionIDs?: string[];
};

export type AiSummary = {
  isViolation?: boolean;
  severity?: Severity;
  reason?: string;
  nature?: SanctionNature;
  victimUserID?: string | null;
  summary?: string;
};

export type ContextMessage = {
  id: string;
  authorID: string;
  authorUsername: string;
  authorAvatarURL?: string;
  content: string;
  createdAt: number;
  referencedMessageID?: string | null;
  referencedAuthorID?: string | null;
  referencedAuthorUsername?: string | null;
  referencedContent?: string | null;
  attachments?: Array<{ url: string; contentType: string; filename: string }>;
};

export type FlaggedMessageItem = {
  id: string;
  guildID: string;
  channelID: string;
  messageID: string;
  reporterID: string;
  targetUserID: string;
  status: FlaggedMessageStatus;
  aiAnalysis: FlagAnalysis | null;
  sanctionID: string | null;
  context: ContextMessage[] | null;
  createdAt: number;
};

export type ModerationReportItem = {
  id: string;
  guildID: string;
  reporterID: string;
  targetUserID: string;
  ticketChannelID: string;
  status: ModerationReportStatus;
  reporterSummary: string;
  confirmationCount?: number;
  sanctionID: string | null;
  context: { messages: ContextMessage[]; aiSummary?: AiSummary } | null;
  createdAt: number;
};

export type SanctionDraft = {
  type: SanctionType;
  severity: Severity;
  nature: SanctionNature;
  reason: string;
  durationMs: number | null;
};

export type AppealDecision = {
  reviewOutcome: "upheld" | "overturned" | "modified" | "sanctioned_bad_faith";
  resolutionReason: string;
  revisedSanction?: SanctionDraft;
  badFaithSanction?: SanctionDraft;
};

export type SourceMeta =
  | { kind: "flag"; data: FlaggedMessageItem }
  | { kind: "report"; data: ModerationReportItem }
  | null;

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  hasMore: boolean;
};
