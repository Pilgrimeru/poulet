import { Command } from "@/discord/types";
import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";

export default class TalkCommand extends Command {
  constructor() {
    super({
      name: "talk",
      description: "fait parler le bot",
      options: [
        {
          name: "message",
          description: "message à envoyer",
          required: true,
          type: ApplicationCommandOptionType.String,
          max_length: 2000,
        },
      ],
    });
  }

  async execute(interaction: ChatInputCommandInteraction) {
    const message = interaction.options.getString("message", true).trim();

    if (!message) {
      return interaction.reply({
        content: "Le message ne peut pas être vide.",
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({
      content: message,
      allowedMentions: { parse: [] },
    });
  }
}
