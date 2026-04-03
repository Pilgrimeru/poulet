import { DMChannel, GuildChannel } from "discord.js";
import { Event } from "@/discord/types";
import { channelMetaService } from "@/api";

export default new Event(
  "channelUpdate",
  async (_oldChannel: DMChannel | GuildChannel, newChannel: DMChannel | GuildChannel) => {
    if (!("guild" in newChannel) || !("name" in newChannel) || !newChannel.name) return;
    const parentID = "parentId" in newChannel ? newChannel.parentId ?? null : null;
    const parentName = "parent" in newChannel && newChannel.parent ? newChannel.parent.name : null;
    await channelMetaService.upsert(newChannel.id, newChannel.guild.id, newChannel.name, parentID, parentName, newChannel.type).catch(() => undefined);
  },
);
