import { EmbedBuilder, GuildMember, PartialGuildMember, TextChannel } from "discord.js";
import { Event } from "@/discord/types";
import { guildSettingsService, userMetaService } from "@/api";
import { memberEventService } from "@/api/memberEventService";
import { memberInviteService } from "@/api/memberInviteService";

function formatTimeOnServer(joinedTimestamp: number | null | undefined): string {
  if (!joinedTimestamp) return "Inconnu";

  const elapsedMs = Date.now() - joinedTimestamp;
  if (elapsedMs <= 0) return "moins d'une minute";

  const totalMinutes = Math.floor(elapsedMs / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(`${days} jour${days > 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} heure${hours > 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);

  return parts.slice(0, 2).join(" ");
}

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
      ? `<@${stored.inviterID}> (${stored.inviterTag})`
      : "Inconnu";
    const timeOnServer = formatTimeOnServer(member.joinedTimestamp);

    const embed = new EmbedBuilder()
      .setColor(0xe03030)
      .setTitle("Membre parti")
      .setThumbnail(member.user?.displayAvatarURL() ?? null)
      .addFields(
        { name: "Utilisateur", value: `${member} (${tag})`, inline: true },
        { name: "Avait été invité par", value: inviterValue, inline: true },
        { name: "Membre depuis", value: timeOnServer, inline: true },
      )
      .setTimestamp();

    await (channel as TextChannel).send({ embeds: [embed] }).catch(() => undefined);
  },
);
