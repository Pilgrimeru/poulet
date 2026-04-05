import { EmbedBuilder, GuildMember, TextChannel } from "discord.js";
import { Event } from "@/discord/types";
import { guildSettingsService, userMetaService } from "@/api";
import { memberEventService } from "@/api/memberEventService";
import { memberInviteService } from "@/api/memberInviteService";
import { findUsedInvite } from "@/services/inviteTrackerService";
import { config } from "@/app";

export default new Event("guildMemberAdd", async (member: GuildMember) => {
  if (!member.user.bot) {
    memberEventService.recordJoin(member.guild.id, member.user.id).catch(() => undefined);
    userMetaService.upsert(
      member.user.id,
      member.guild.id,
      member.user.username,
      member.nickname ?? member.user.globalName ?? member.user.username,
      member.displayAvatarURL(),
    ).catch(() => undefined);
  }

  const settings = await guildSettingsService.getByGuildID(member.guild.id).catch(() => null);
  if (!settings?.inviteLogChannelID) return;

  const channel = member.guild.channels.cache.get(settings.inviteLogChannelID);
  if (!channel?.isTextBased()) return;

  const [invite, isRejoin] = await Promise.all([
    findUsedInvite(member.guild),
    memberEventService.hasJoinedBefore(member.guild.id, member.user.id).catch(() => false),
  ]);

  if (invite?.inviter) {
    memberInviteService
      .store(member.guild.id, member.user.id, invite.inviter.id, invite.inviter.tag, invite.code)
      .catch(() => undefined);
  }

  const title = isRejoin ? "Membre rejoint (retour)" : "Membre rejoint";

  const embed = new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle(title)
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: "Utilisateur", value: `${member} (${member.user.tag})`, inline: true },
      {
        name: "Invité par",
        value: invite?.inviter ? `${invite.inviter} (${invite.inviter.tag})` : "Inconnu",
        inline: true,
      },
    )
    .setFooter({ text: `Code : ${invite?.code ?? "inconnu"} · Utilisations : ${invite?.uses ?? "?"}` })
    .setTimestamp();

  await (channel as TextChannel).send({ embeds: [embed] }).catch(() => undefined);
});
