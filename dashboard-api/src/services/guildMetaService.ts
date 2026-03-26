import { GuildMeta } from "../db/models/GuildMeta";

export async function upsertGuildMeta(guildID: string, name: string, iconURL: string): Promise<void> {
  await GuildMeta.upsert({ guildID, name, iconURL });
}
