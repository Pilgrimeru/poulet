import { EmbedBuilder, GuildMember, PartialGuildMember, TextChannel } from "discord.js";
import { Event } from "@/discord/types";
import { guildSettingsService, userMetaService } from "@/api";
import { memberEventService } from "@/api/memberEventService";

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

    const embed = new EmbedBuilder()
      .setColor(0xe03030)
      .setTitle("Membre parti")
      .setThumbnail(member.user?.displayAvatarURL() ?? null)
      .addFields({ name: "Utilisateur", value: `${member} (${tag})`, inline: true })
      .setTimestamp();

    await (channel as TextChannel).send({ embeds: [embed] }).catch(() => undefined);
  },
);
