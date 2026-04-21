import { Command } from "@/discord/types";
import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";

function toDiscordTimestamp(date: Date): string {
  const unix = Math.floor(date.getTime() / 1000);
  return `<t:${unix}:f> (<t:${unix}:R>)`;
}

export default class GetUserDetailsCommand extends Command {
  constructor() {
    super({
      name: "getuserdetails",
      description: "Affiche les informations importantes d'un utilisateur",
      defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
      options: [
        {
          name: "utilisateur",
          description: "Utilisateur dont tu veux les informations",
          type: ApplicationCommandOptionType.User,
          required: false,
        },
      ],
    });
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: "Cette commande doit etre utilisee dans un serveur.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const targetUser =
      interaction.options.getUser("utilisateur", false) ?? interaction.user;
    const member = await interaction.guild.members
      .fetch(targetUser.id)
      .catch(() => null);

    const createdAt = toDiscordTimestamp(targetUser.createdAt);
    const joinedAt = member?.joinedAt
      ? toDiscordTimestamp(member.joinedAt)
      : "Non disponible";
    const username = `${targetUser.username}${targetUser.discriminator === "0" ? "" : `#${targetUser.discriminator}`}`;
    const nickname = member?.nickname ?? "Aucun";
    const highestRole = member?.roles.highest
      ? `<@&${member.roles.highest.id}>`
      : "Non disponible";
    const roleCount = member ? Math.max(member.roles.cache.size - 1, 0) : 0;
    const isBot = targetUser.bot ? "Oui" : "Non";

    const embed = new EmbedBuilder()
      .setTitle("Details utilisateur")
      .setThumbnail(targetUser.displayAvatarURL())
      .setColor(0x5865f2)
      .addFields(
        { name: "Mention", value: `<@${targetUser.id}>`, inline: true },
        { name: "ID", value: targetUser.id, inline: true },
        { name: "Bot", value: isBot, inline: true },
        { name: "Nom d'utilisateur", value: username, inline: true },
        { name: "Pseudo serveur", value: nickname, inline: true },
        { name: "Role le plus haut", value: highestRole, inline: true },
        { name: "Date de création du compte", value: createdAt, inline: false },
        {
          name: "Date d'arrivee sur le serveur",
          value: joinedAt,
          inline: false,
        },
        { name: "Nombre de rôles", value: roleCount.toString(), inline: true },
      )
      .setFooter({ text: `Demande par ${interaction.user.username}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
}
