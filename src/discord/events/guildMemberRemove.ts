import { EmbedBuilder, GuildMember, PartialGuildMember, TextChannel } from "discord.js";
import { Event } from "@/discord/types";
import { guildSettingsService, userMetaService } from "@/api";
import { memberEventService } from "@/api/memberEventService";
import { memberInviteService } from "@/api/memberInviteService";

export default new Event(
  "guildMemberRemove",
  async (member: GuildMember | PartialGuildMember) => {
    if (!member.user || member.user.bot) return;

    memberEventService.recordLeave(member.guild.id, member.user.id).catch(() => undefined);
    userMetaService.markDeleted(member.user.id, member.guild.id).catch(() => undefined);

    const settings = await guildSettingsService.getByGuildID(member.guild.id).catch(() => null);
    if (!settings?.inviteLogChannelID) return;

    const channel = member.guild.channels.cache.get(settings.inviteLogChannelID);
    if (!channel?.isTextBased()) return;

    const tag = member.user?.tag ?? member.user?.username ?? "Inconnu";

    const stored = await memberInviteService.get(member.guild.id, member.user.id).catch(() => null);
    memberInviteService.remove(member.guild.id, member.user.id).catch(() => undefined);

    const inviterValue = stored
      ? `<@${stored.inviterID}> (${stored.inviterTag}) · Code : ${stored.code}`
      : "Inconnu";

    const embed = new EmbedBuilder()
      .setColor(0xe03030)
      .setTitle("Membre parti")
      .setThumbnail(member.user?.displayAvatarURL() ?? null)
      .addFields(
        { name: "Utilisateur", value: `${member} (${tag})`, inline: true },
        { name: "Avait été invité par", value: inviterValue, inline: true },
      )
      .setTimestamp();

    await (channel as TextChannel).send({ embeds: [embed] }).catch(() => undefined);
  },
);
