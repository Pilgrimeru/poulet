import { GuildChannel } from "discord.js";
import { Event } from "@/discord/types";
import { channelMetaService } from "@/api";

export default new Event("channelCreate", async (channel: GuildChannel) => {
  if (!("name" in channel) || !channel.name) return;
  const parentID = "parentId" in channel ? channel.parentId ?? null : null;
  const parentName = "parent" in channel && channel.parent ? channel.parent.name : null;
  await channelMetaService.upsert(channel.id, channel.guild.id, channel.name, parentID, parentName, channel.type);
});
