import { ChannelMeta } from "../db/models/ChannelMeta";

export async function upsertChannelMeta(channelID: string, guildID: string, name: string): Promise<void> {
  await ChannelMeta.upsert({ channelID, guildID, name });
}
