import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import { createTimedCache } from "./cache";

export interface TriggerGroup {
  keywords: string[];
  keywordMode: "any" | "all";
  regex: string | null;
  hasAttachment: boolean | null;
}

export type ChannelMode = "all" | "whitelist" | "blacklist";

export interface AutoResponseDTO {
  id: string;
  guildID: string;
  name: string;
  enabled: boolean;
  triggerGroups: TriggerGroup[];
  channelMode: ChannelMode;
  channelIDs: string[];
  responseEmojis: string[];
  responseMessage: string | null;
  responseReply: boolean;
}

const cache = createTimedCache<string, AutoResponseDTO[]>(30_000);

export const autoResponseService = {
  async getByGuildID(guildID: string): Promise<AutoResponseDTO[]> {
    return cache.getOrLoad(guildID, () => apiGet(`/guilds/${guildID}/auto-responses`));
  },

  async create(guildID: string, patch: Partial<Omit<AutoResponseDTO, "id" | "guildID">> = {}): Promise<AutoResponseDTO> {
    const created = await apiPost<AutoResponseDTO>(`/guilds/${guildID}/auto-responses`, patch);
    cache.delete(guildID);
    return created;
  },

  async update(guildID: string, id: string, patch: Partial<Omit<AutoResponseDTO, "id" | "guildID">>): Promise<AutoResponseDTO> {
    const updated = await apiPatch<AutoResponseDTO>(`/guilds/${guildID}/auto-responses/${id}`, patch);
    cache.delete(guildID);
    return updated;
  },

  async delete(guildID: string, id: string): Promise<boolean> {
    const result = await apiDelete<{ deleted: boolean }>(`/guilds/${guildID}/auto-responses/${id}`);
    cache.delete(guildID);
    return result.deleted;
  },

  invalidate(guildID: string): void {
    cache.delete(guildID);
  },
};
