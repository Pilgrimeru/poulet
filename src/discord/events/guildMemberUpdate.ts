import { GuildMember, PartialGuildMember } from "discord.js";
import { Event } from "@/discord/types";

export default new Event(
  "guildMemberUpdate",
  async (
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember | PartialGuildMember,
  ) => {
    console.log(
      `guildMemberUpdate: ${oldMember.displayName} => ${newMember.displayName}`,
    );
  },
);
