import { GuildMeta } from "../models/GuildMeta";

export async function upsertGuildMeta(guildID: string, name: string, iconURL: string): Promise<void> {
  await GuildMeta.upsert({ guildID, name, iconURL });
}

export async function upsertGuildMetas(rows: Array<{ guildID: string; name: string; iconURL: string }>): Promise<void> {
  if (rows.length === 0) return;
  await GuildMeta.bulkCreate(rows, {
    updateOnDuplicate: ["name", "iconURL"],
  });
}
