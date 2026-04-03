import { apiDeleteWithBody, apiGet, apiPost } from "./client";

export interface GuildChannelMetaDTO {
  channelID: string;
  channelName: string;
  parentID: string | null;
  parentName: string | null;
  channelType: number | null;
}

export const channelMetaService = {
  async upsert(channelID: string, guildID: string, name: string, parentID?: string | null, parentName?: string | null, channelType?: number | null): Promise<void> {
    await apiPost("/channel-meta", { channelID, guildID, name, parentID: parentID ?? null, parentName: parentName ?? null, channelType: channelType ?? null });
  },

  async bulkUpsert(rows: Array<{
    channelID: string;
    guildID: string;
    name: string;
    parentID?: string | null;
    parentName?: string | null;
    channelType?: number | null;
  }>): Promise<void> {
    await apiPost("/channel-meta", { rows });
  },

  async markDeleted(channelID: string): Promise<void> {
    await apiDeleteWithBody("/channel-meta", { channelID });
  },

  async markDeletedExcept(guildID: string, activeChannelIDs: string[]): Promise<void> {
    await apiDeleteWithBody("/channel-meta", { guildID, activeChannelIDs });
  },

  async listByGuild(guildID: string): Promise<GuildChannelMetaDTO[]> {
    return apiGet<GuildChannelMetaDTO[]>(`/guilds/${guildID}/discord-channels`);
  },
};
