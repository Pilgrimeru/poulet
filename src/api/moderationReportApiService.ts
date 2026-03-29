import { apiGet, apiPatch, apiPost } from "./client";

export interface ModerationReportDTO {
  id: string;
  guildID: string;
  reporterID: string;
  targetUserID: string;
  ticketChannelID: string;
  status: string;
  reporterSummary: string;
  aiQuestions: string[];
  aiQQOQCCP: string | null;
  confirmationCount: number;
  warnID: string | null;
  sanctionID: string | null;
  appealText: string | null;
  appealStatus: string | null;
  appealAt: number | null;
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
  aiQuestions?: string[];
  aiQQOQCCP?: string | null;
  confirmationCount?: number;
  warnID?: string | null;
  sanctionID?: string | null;
  appealText?: string | null;
  appealStatus?: string | null;
  appealAt?: number | null;
  moderatorID?: string | null;
  createdAt?: number;
}

export interface UpdateModerationReportInput {
  status?: string;
  reporterSummary?: string;
  aiQuestions?: string[];
  aiQQOQCCP?: string | null;
  confirmationCount?: number;
  warnID?: string | null;
  sanctionID?: string | null;
  appealText?: string | null;
  appealStatus?: string | null;
  appealAt?: number | null;
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

  async list(guildID: string, options?: { appealStatus?: string; status?: string }): Promise<ModerationReportDTO[]> {
    const params = new URLSearchParams();
    if (options?.appealStatus) params.set("appealStatus", options.appealStatus);
    if (options?.status) params.set("status", options.status);
    const query = params.size > 0 ? `?${params.toString()}` : "";
    return apiGet<ModerationReportDTO[]>(`/guilds/${guildID}/moderation-reports${query}`);
  },

  async update(guildID: string, reportID: string, patch: UpdateModerationReportInput): Promise<ModerationReportDTO> {
    return apiPatch<ModerationReportDTO>(`/guilds/${guildID}/moderation-reports/${reportID}`, patch);
  },
};
