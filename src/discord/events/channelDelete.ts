import { DMChannel, GuildChannel } from "discord.js";
import { Event } from "@/discord/types";
import { channelMetaService } from "@/api";

export default new Event(
  "channelDelete",
  async (channel: DMChannel | GuildChannel) => {
    if (!("guild" in channel)) return;
    await channelMetaService.markDeleted(channel.id).catch(() => undefined);
  },
);
