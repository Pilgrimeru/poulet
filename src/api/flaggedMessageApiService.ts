import { apiGet, apiPatch, apiPost } from "./client";

export interface ContextMessage {
  id: string;
  authorID: string;
  authorUsername: string;
  authorAvatarURL: string;
  content: string;
  createdAt: number;
  referencedMessageID: string | null;
  referencedAuthorID?: string | null;
  referencedAuthorUsername?: string | null;
  referencedContent?: string | null;
  attachments?: Array<{
    url: string;
    contentType: string;
    filename: string;
  }>;
}

export interface FlaggedMessageDTO {
  id: string;
  guildID: string;
  channelID: string;
  messageID: string;
  reporterID: string;
  targetUserID: string;
  status: string;
  aiAnalysis: unknown;
  sanctionID: string | null;
  context: ContextMessage[] | null;
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
  sanctionID?: string | null;
  context?: ContextMessage[] | null;
  moderatorID?: string | null;
  createdAt?: number;
}

export interface UpdateFlaggedMessageInput {
  status?: string;
  aiAnalysis?: unknown;
  sanctionID?: string | null;
  context?: ContextMessage[] | null;
  moderatorID?: string | null;
}

export const flaggedMessageApiService = {
  async create(input: CreateFlaggedMessageInput): Promise<FlaggedMessageDTO> {
    return apiPost<FlaggedMessageDTO>(`/guilds/${input.guildID}/flagged-messages`, input);
  },

  async list(guildID: string, options?: { targetUserID?: string; reporterID?: string; status?: string; createdSince?: number }): Promise<FlaggedMessageDTO[]> {
    const params = new URLSearchParams();
    if (options?.targetUserID) params.set("targetUserId", options.targetUserID);
    if (options?.reporterID) params.set("reporterId", options.reporterID);
    if (options?.status) params.set("status", options.status);
    if (typeof options?.createdSince === "number") params.set("createdSince", String(options.createdSince));
    const query = params.size > 0 ? `?${params.toString()}` : "";
    const result = await apiGet<{ items: FlaggedMessageDTO[] } | FlaggedMessageDTO[]>(`/guilds/${guildID}/flagged-messages${query}`);
    return Array.isArray(result) ? result : result.items;
  },

  async update(guildID: string, flagID: string, patch: UpdateFlaggedMessageInput): Promise<FlaggedMessageDTO> {
    return apiPatch<FlaggedMessageDTO>(`/guilds/${guildID}/flagged-messages/${flagID}`, patch);
  },
};
