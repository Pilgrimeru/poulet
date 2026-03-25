import { GuildMeta } from "@/database/models/GuildMeta";

class GuildMetaService {
  async upsert(guildID: string, name: string, iconURL: string): Promise<void> {
    await GuildMeta.upsert({ guildID, name, iconURL });
  }
}

export const guildMetaService = new GuildMetaService();
