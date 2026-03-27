import { GuildMeta } from "../models/GuildMeta";

export async function upsertGuildMeta(guildID: string, name: string, iconURL: string): Promise<void> {
  await GuildMeta.upsert({ guildID, name, iconURL });
}
