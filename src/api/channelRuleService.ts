import { apiDelete, apiGet, apiPut } from "./client";
import { createTimedCache } from "./cache";

export type ChannelRuleMessageFilter = "all" | "images" | "links";

export interface ChannelRuleDTO {
  id: string;
  guildID: string;
  channelID: string;
  reactEmojis: string[];
  reactFilter: ChannelRuleMessageFilter[];
  autoThread: boolean;
  oneMessageLimit: boolean;
}

const guildChannelRulesCache = createTimedCache<string, ChannelRuleDTO[]>(30_000);
const channelRuleCache = createTimedCache<string, ChannelRuleDTO | null>(30_000);

function channelCacheKey(guildID: string, channelID: string): string {
  return `${guildID}:${channelID}`;
}

export const channelRuleService = {
  async getRulesByGuildID(guildID: string): Promise<ChannelRuleDTO[]> {
    return guildChannelRulesCache.getOrLoad(guildID, () => apiGet(`/guilds/${guildID}/channel-rules`));
  },

  async getRuleByChannel(guildID: string, channelID: string): Promise<ChannelRuleDTO | null> {
    const key = channelCacheKey(guildID, channelID);
    return channelRuleCache.getOrLoad(key, async () => {
      const guildRules = guildChannelRulesCache.get(guildID);
      if (guildRules !== undefined) {
        return guildRules.find((rule) => rule.channelID === channelID) ?? null;
      }

      try {
        return await apiGet(`/guilds/${guildID}/channel-rules/by-channel/${channelID}`);
      } catch {
        return null;
      }
    });
  },

  async getRuleByID(guildID: string, id: string): Promise<ChannelRuleDTO | null> {
    try {
      const rules = await this.getRulesByGuildID(guildID);
      return rules.find((rule) => rule.id === id) ?? null;
    } catch {
      return null;
    }
  },

  async upsertRule(
    guildID: string,
    channelID: string,
    patch: Partial<Omit<ChannelRuleDTO, "id" | "guildID" | "channelID">>,
  ): Promise<ChannelRuleDTO> {
    const updated = await apiPut<ChannelRuleDTO>(`/guilds/${guildID}/channel-rules/${channelID}`, patch);
    guildChannelRulesCache.delete(guildID);
    channelRuleCache.set(channelCacheKey(guildID, channelID), updated);
    return updated;
  },

  async deleteRule(guildID: string, channelID: string): Promise<boolean> {
    const result = await apiDelete<{ deleted: boolean }>(`/guilds/${guildID}/channel-rules/${channelID}`);
    guildChannelRulesCache.delete(guildID);
    channelRuleCache.set(channelCacheKey(guildID, channelID), null);
    return result.deleted;
  },
};
