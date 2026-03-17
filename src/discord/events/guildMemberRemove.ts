import { GuildMember, PartialGuildMember } from "discord.js";
import { Event } from "@/discord/types";

export default new Event(
  "guildMemberRemove",
  async (member: GuildMember | PartialGuildMember) => {
    console.log(
      `guildMemberRemove: ${member.user.tag} has left or been kicked from the guild`,
    );
  },
);
