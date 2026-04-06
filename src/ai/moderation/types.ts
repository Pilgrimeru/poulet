import { z } from "zod";
import type { ContextMessage } from "@/api/flaggedMessageApiService";
import { FlagAnalysisSchema, SummarySchema } from "./schemas";

export interface FlagAnalysisInput {
  guildID: string;
  reporterID: string;
  reporterUsername?: string | null;
  reporterDisplayName?: string | null;
  targetUserID: string;
  targetUsername?: string | null;
  targetDisplayName?: string | null;
  messageMentions?: Array<{ id: string; username?: string | null; displayName?: string | null }>;
  messageContent: string;
  messageCreatedAt: number;
  contextMessages: ContextMessage[];
  alreadySanctionedMessageIDs?: Set<string>;
}

export interface ReportAnalysisInput {
  guildID: string;
  reporterID: string;
  targetUserID: string;
  transcript: string;
  /** Unix timestamp (ms) approximating when the violation occurred — used to exclude sanctions issued after the fact from recidivism escalation. Defaults to Date.now(). */
  anchorTimestamp?: number;
  sanctionedMessageIDs?: Set<string>;
}

export type HistoryQuery = {
  userID: string;
  startAt: string | null;
  endAt: string | null;
  onlyDeleted: boolean;
  channelID: string | null;
  search: string | null;
  searchTerms: string[] | null;
  searchMode: "any" | "all" | null;
  limit: number;
};

export type SanctionsQuery = {
  userID: string;
  limit: number;
};

export type ChannelsQuery = {
  nameQuery: string | null;
  limit: number;
};

export type FlagAnalysisResult = z.infer<typeof FlagAnalysisSchema>;
export type SummaryResult = z.infer<typeof SummarySchema>;
