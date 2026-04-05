import { GuildMember, PartialGuildMember } from "discord.js";
import { Event } from "@/discord/types";
import { userMetaService } from "@/api";

export default new Event(
  "guildMemberUpdate",
  async (
    _oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember | PartialGuildMember,
  ) => {
    if (newMember.user?.bot) return;
    const user = newMember.user;
    if (!user) return;
    await userMetaService.upsert(
      user.id,
      newMember.guild.id,
      user.username,
      newMember.nickname ?? user.globalName ?? user.username,
      newMember.displayAvatarURL(),
    ).catch(() => undefined);
  },
);
