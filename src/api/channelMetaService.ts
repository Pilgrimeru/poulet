import { apiPost } from "./client";

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
};
