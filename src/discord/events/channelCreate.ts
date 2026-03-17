import { GuildChannel } from "discord.js";
import { Event } from "@/discord/types";

export default new Event("channelCreate", async (channel: GuildChannel) => {
  console.log(`channelCreate: ${channel}`);
});
