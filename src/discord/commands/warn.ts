import { Command } from "@/discord/types";
import { sendWarn, WarnSeverity } from "@/services/warnService";
import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";

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
            { name: "🟡 Faible", value: "faible" },
            { name: "🟠 Moyen", value: "moyen" },
            { name: "🔴 Élevé", value: "élevé" },
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

    await sendWarn(interaction, {
      target,
      severity,
      message,
      moderator: interaction.user,
    });
  }
}
