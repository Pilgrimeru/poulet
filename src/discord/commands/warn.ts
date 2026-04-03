import { Command } from "@/discord/types";
import { buildSanctionEmbed } from "@/discord/components/moderation/sanctionHelpers";
import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";

type WarnSeverity = "LOW" | "MEDIUM" | "HIGH";

function warnSeverityToType(severity: WarnSeverity): "WARN_LOW" | "WARN_MEDIUM" | "WARN_HIGH" {
  if (severity === "LOW") return "WARN_LOW";
  if (severity === "MEDIUM") return "WARN_MEDIUM";
  return "WARN_HIGH";
}

export default class WarnCommand extends Command {
  constructor() {
    super({
      name: "warn",
      description: "Signaler un utilisateur avec un niveau de gravité",
      defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
      options: [
        {
          name: "utilisateur",
          description: "L'utilisateur à signaler",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "gravité",
          description: "Niveau de gravité du signalement",
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: [
            { name: "🟡 Faible", value: "LOW" },
            { name: "🟠 Moyen", value: "MEDIUM" },
            { name: "🔴 Élevé", value: "HIGH" },
          ],
        },
        {
          name: "message",
          description: "Raison ou description du signalement",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    });
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: "Cette commande doit être utilisée dans un serveur.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const target = interaction.options.getUser("utilisateur", true);
    const severity = interaction.options.getString("gravité", true) as WarnSeverity;
    const message = interaction.options.getString("message", true);

    if (target.id === interaction.user.id) {
      await interaction.reply({
        content: "Tu ne peux pas te signaler toi-même.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed = buildSanctionEmbed({
      target,
      moderator: interaction.user,
      type: warnSeverityToType(severity),
      severity,
      reason: message,
    });

    const channel = interaction.channel as TextChannel | null;
    if (!channel) {
      await interaction.reply({
        content: "Salon introuvable.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await channel.send({
      content: `${target}`,
      embeds: [embed],
    });

    await interaction.reply({
      content: "Signalement envoyé.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
