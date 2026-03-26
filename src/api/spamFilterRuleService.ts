import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

export type SpamFilterMode = "whitelist" | "blacklist";

export interface SpamFilterRuleDTO {
  id: string;
  guildID: string;
  name: string;
  description: string;
  mode: SpamFilterMode;
  channelIDs: string[];
  messageLimit: number;
  intervalInSec: number;
  punishmentDurationInSec: number;
  enabled: boolean;
}

export const spamFilterRuleService = {
  async getRulesByGuildID(guildID: string): Promise<SpamFilterRuleDTO[]> {
    return apiGet(`/guilds/${guildID}/spam-rules`);
  },

  async getRuleByID(guildID: string, id: string): Promise<SpamFilterRuleDTO | null> {
    try {
      return await apiGet(`/guilds/${guildID}/spam-rules/${id}`);
    } catch {
      return null;
    }
  },

  async createRule(input: Omit<SpamFilterRuleDTO, "id">): Promise<SpamFilterRuleDTO> {
    return apiPost(`/guilds/${input.guildID}/spam-rules`, input);
  },

  async updateRule(
    guildID: string,
    id: string,
    patch: Partial<Omit<SpamFilterRuleDTO, "id" | "guildID">>,
  ): Promise<SpamFilterRuleDTO | null> {
    try {
      return await apiPatch(`/guilds/${guildID}/spam-rules/${id}`, patch);
    } catch {
      return null;
    }
  },

  async deleteRule(guildID: string, id: string): Promise<boolean> {
    const result = await apiDelete<{ deleted: boolean }>(`/guilds/${guildID}/spam-rules/${id}`);
    return result.deleted;
  },
};
