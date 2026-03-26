import { apiDelete, apiGet, apiPut } from "./client";

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

export const channelRuleService = {
  async getRulesByGuildID(guildID: string): Promise<ChannelRuleDTO[]> {
    return apiGet(`/guilds/${guildID}/channel-rules`);
  },

  async getRuleByChannel(guildID: string, channelID: string): Promise<ChannelRuleDTO | null> {
    try {
      return await apiGet(`/guilds/${guildID}/channel-rules/by-channel/${channelID}`);
    } catch {
      return null;
    }
  },

  async getRuleByID(guildID: string, id: string): Promise<ChannelRuleDTO | null> {
    try {
      return await apiGet(`/guilds/${guildID}/channel-rules/by-id/${id}`);
    } catch {
      return null;
    }
  },

  async upsertRule(
    guildID: string,
    channelID: string,
    patch: Partial<Omit<ChannelRuleDTO, "id" | "guildID" | "channelID">>,
  ): Promise<ChannelRuleDTO> {
    return apiPut(`/guilds/${guildID}/channel-rules/${channelID}`, patch);
  },

  async deleteRule(guildID: string, channelID: string): Promise<boolean> {
    const result = await apiDelete<{ deleted: boolean }>(`/guilds/${guildID}/channel-rules/${channelID}`);
    return result.deleted;
  },
};
