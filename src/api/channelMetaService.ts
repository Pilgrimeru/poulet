import { apiPost } from "./client";

export const channelMetaService = {
  async upsert(channelID: string, guildID: string, name: string): Promise<void> {
    await apiPost("/channel-meta", { channelID, guildID, name });
  },
};
