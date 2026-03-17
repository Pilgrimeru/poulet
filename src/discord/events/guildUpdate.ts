import { Guild } from "discord.js";
import { Event } from "@/discord/types";

export default new Event(
  "guildUpdate",
  async (oldGuild: Guild, newGuild: Guild) => {
    console.log(`guildUpdate: ${oldGuild.name} => ${newGuild.name}`);
  },
);
