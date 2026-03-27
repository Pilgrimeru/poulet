import { EmbedBuilder, GuildMember, TextChannel } from "discord.js";
import { Event } from "@/discord/types";
import { guildSettingsService } from "@/api";
import { findUsedInvite } from "@/services/inviteTrackerService";
import { config } from "@/app";

export default new Event("guildMemberAdd", async (member: GuildMember) => {
  const settings = await guildSettingsService.getByGuildID(member.guild.id).catch(() => null);
  if (!settings?.inviteLogChannelID) return;

  const channel = member.guild.channels.cache.get(settings.inviteLogChannelID);
  if (!channel?.isTextBased()) return;

  const invite = await findUsedInvite(member.guild);

  const embed = new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle("Membre rejoint")
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
