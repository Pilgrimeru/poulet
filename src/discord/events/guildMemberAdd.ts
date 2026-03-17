import { GuildMember } from "discord.js";
import { Event } from "@/discord/types";

export default new Event("guildMemberAdd", async (member: GuildMember) => {
  console.log(`guildMemberAdd: ${member.user.tag} has joined the guild`);
});
