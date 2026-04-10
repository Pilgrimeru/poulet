import { apiGet, apiPatch, apiPost } from "./client";
import type { ContextMessage } from "./flaggedMessageApiService";

export type { ContextMessage } from "./flaggedMessageApiService";

export interface ReportContext {
  messages: ContextMessage[];
  aiSummary?: unknown;
}

export interface ModerationReportDTO {
  id: string;
  guildID: string;
  reporterID: string;
  targetUserID: string;
  ticketChannelID: string;
  status: string;
  reporterSummary: string;
  confirmationCount: number;
  sanctionID: string | null;
  context: ReportContext | null;
  moderatorID: string | null;
  createdAt: number;
}

export interface CreateModerationReportInput {
  guildID: string;
  reporterID: string;
  targetUserID: string;
  ticketChannelID: string;
  status?: string;
  reporterSummary: string;
  confirmationCount?: number;
  sanctionID?: string | null;
  context?: ReportContext | null;
  moderatorID?: string | null;
  createdAt?: number;
}

export interface UpdateModerationReportInput {
  status?: string;
  reporterSummary?: string;
  confirmationCount?: number;
  sanctionID?: string | null;
  context?: ReportContext | null;
  moderatorID?: string | null;
}

export const moderationReportApiService = {
  async create(input: CreateModerationReportInput): Promise<ModerationReportDTO> {
    return apiPost<ModerationReportDTO>(`/guilds/${input.guildID}/moderation-reports`, input);
  },

  async get(guildID: string, reportID: string): Promise<ModerationReportDTO> {
    return apiGet<ModerationReportDTO>(`/guilds/${guildID}/moderation-reports/${reportID}`);
  },

  async getByChannel(guildID: string, channelID: string): Promise<ModerationReportDTO | null> {
    return apiGet<ModerationReportDTO | null>(`/guilds/${guildID}/moderation-reports?channelId=${encodeURIComponent(channelID)}`);
  },

  async list(guildID: string, options?: { status?: string; reporterID?: string; createdSince?: number }): Promise<ModerationReportDTO[]> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.reporterID) params.set("reporterId", options.reporterID);
    if (typeof options?.createdSince === "number") params.set("createdSince", String(options.createdSince));
    const query = params.size > 0 ? `?${params.toString()}` : "";
    const result = await apiGet<{ items: ModerationReportDTO[] } | ModerationReportDTO[]>(`/guilds/${guildID}/moderation-reports${query}`);
    return Array.isArray(result) ? result : result.items;
  },

  async update(guildID: string, reportID: string, patch: UpdateModerationReportInput): Promise<ModerationReportDTO> {
    return apiPatch<ModerationReportDTO>(`/guilds/${guildID}/moderation-reports/${reportID}`, patch);
  },
};
