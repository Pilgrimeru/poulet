import { ChannelMeta } from "@/database/models/ChannelMeta";

class ChannelMetaService {
  async upsert(channelID: string, guildID: string, name: string): Promise<void> {
    await ChannelMeta.upsert({ channelID, guildID, name });
  }
}

export const channelMetaService = new ChannelMetaService();
