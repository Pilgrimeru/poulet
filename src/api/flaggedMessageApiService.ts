import { apiGet, apiPatch, apiPost } from "./client";

export interface FlaggedMessageDTO {
  id: string;
  guildID: string;
  channelID: string;
  messageID: string;
  reporterID: string;
  targetUserID: string;
  status: string;
  aiAnalysis: unknown;
  warnID: string | null;
  sanctionID: string | null;
  appealText: string | null;
  appealStatus: string | null;
  appealAt: number | null;
  moderatorID: string | null;
  createdAt: number;
}

export interface CreateFlaggedMessageInput {
  guildID: string;
  channelID: string;
  messageID: string;
  reporterID: string;
  targetUserID: string;
  status?: string;
  aiAnalysis?: unknown;
  warnID?: string | null;
  sanctionID?: string | null;
  appealText?: string | null;
  appealStatus?: string | null;
  appealAt?: number | null;
  moderatorID?: string | null;
  createdAt?: number;
}

export interface UpdateFlaggedMessageInput {
  status?: string;
  aiAnalysis?: unknown;
  warnID?: string | null;
  sanctionID?: string | null;
  appealText?: string | null;
  appealStatus?: string | null;
  appealAt?: number | null;
  moderatorID?: string | null;
}

export const flaggedMessageApiService = {
  async create(input: CreateFlaggedMessageInput): Promise<FlaggedMessageDTO> {
    return apiPost<FlaggedMessageDTO>(`/guilds/${input.guildID}/flagged-messages`, input);
  },

  async list(guildID: string, options?: { targetUserID?: string; appealStatus?: string; status?: string }): Promise<FlaggedMessageDTO[]> {
    const params = new URLSearchParams();
    if (options?.targetUserID) params.set("targetUserId", options.targetUserID);
    if (options?.appealStatus) params.set("appealStatus", options.appealStatus);
    if (options?.status) params.set("status", options.status);
    const query = params.size > 0 ? `?${params.toString()}` : "";
    return apiGet<FlaggedMessageDTO[]>(`/guilds/${guildID}/flagged-messages${query}`);
  },

  async update(guildID: string, flagID: string, patch: UpdateFlaggedMessageInput): Promise<FlaggedMessageDTO> {
    return apiPatch<FlaggedMessageDTO>(`/guilds/${guildID}/flagged-messages/${flagID}`, patch);
  },
};
