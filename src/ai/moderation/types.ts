import { z } from "zod";
import type { ContextMessage } from "@/api/flaggedMessageApiService";
import { FlagAnalysisSchema, SummarySchema } from "./schemas";

export type PriorSanctionSummary = {
  id: string;
  type: string;
  severity: string;
  nature: string;
  reason: string;
  state: string;
  createdAt: number;
};

export interface FlagAnalysisInput {
  guildID: string;
  reporterID: string;
  reporterUsername?: string | null;
  reporterDisplayName?: string | null;
  targetUserID: string;
  targetUsername?: string | null;
  targetDisplayName?: string | null;
  priorSanctions?: PriorSanctionSummary[];
  messageMentions?: Array<{ id: string; username?: string | null; displayName?: string | null }>;
  messageContent: string;
  contextMessages: ContextMessage[];
}

export interface ReportAnalysisInput {
  guildID: string;
  reporterID: string;
  targetUserID: string;
  transcript: string;
  priorSanctions?: PriorSanctionSummary[];
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
