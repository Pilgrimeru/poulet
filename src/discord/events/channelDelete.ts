import { DMChannel, GuildChannel } from "discord.js";
import { Event } from "@/discord/types";

export default new Event(
  "channelDelete",
  async (channel: DMChannel | GuildChannel) => {
    console.log(`channelDelete: ${channel}`);
  },
);
