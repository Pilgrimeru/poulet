import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import { createTimedCache } from "./cache";

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

const guildRulesCache = createTimedCache<string, SpamFilterRuleDTO[]>(30_000);

export const spamFilterRuleService = {
  async getRulesByGuildID(guildID: string): Promise<SpamFilterRuleDTO[]> {
    return guildRulesCache.getOrLoad(guildID, () => apiGet(`/guilds/${guildID}/spam-rules`));
  },

  async getRuleByID(guildID: string, id: string): Promise<SpamFilterRuleDTO | null> {
    try {
      const rules = await this.getRulesByGuildID(guildID);
      return rules.find((rule) => rule.id === id) ?? null;
    } catch {
      return null;
    }
  },

  async createRule(input: Omit<SpamFilterRuleDTO, "id">): Promise<SpamFilterRuleDTO> {
    const created = await apiPost<SpamFilterRuleDTO>(`/guilds/${input.guildID}/spam-rules`, input);
    guildRulesCache.delete(input.guildID);
    return created;
  },

  async updateRule(
    guildID: string,
    id: string,
    patch: Partial<Omit<SpamFilterRuleDTO, "id" | "guildID">>,
  ): Promise<SpamFilterRuleDTO | null> {
    try {
      const updated = await apiPatch<SpamFilterRuleDTO>(`/guilds/${guildID}/spam-rules/${id}`, patch);
      guildRulesCache.delete(guildID);
      return updated;
    } catch {
      return null;
    }
  },

  async deleteRule(guildID: string, id: string): Promise<boolean> {
    const result = await apiDelete<{ deleted: boolean }>(`/guilds/${guildID}/spam-rules/${id}`);
    guildRulesCache.delete(guildID);
    return result.deleted;
  },
};
