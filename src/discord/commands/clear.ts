import { Command } from "@/discord/types";
import { autoDelete } from "@/discord/utils";
import {
  ApplicationCommandOptionType,
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";

export default class RuleCommand extends Command {
  constructor() {
    super({
      name: "clear",
      description: "supprime le nombre de message indiqué",
      defaultMemberPermissions: PermissionFlagsBits.ManageMessages,
      options: [
        {
          name: "number",
          description: "nombre de message à supprimé",
          required: true,
          type: ApplicationCommandOptionType.Integer,
          min_value: 1,
          max_value: 200,
        },
      ],
    });
  }

  async execute(interaction: ChatInputCommandInteraction) {
    const number = interaction.options.getInteger("number", true);
    const now = Date.now();
    const messages = await interaction.channel!.messages.fetch({
      limit: number,
    });
    if (!messages)
      return interaction.reply("Aucun message nettoyable.").then(autoDelete);

    let messagesVieuxMoins14Jours = 0;
    for (const [_string, message] of messages) {
      const differenceEnMillisecondes = now - message.createdAt.getTime();
      const differenceEnJours =
        differenceEnMillisecondes / (1000 * 60 * 60 * 24);
      if (differenceEnJours >= 14) break;
      messagesVieuxMoins14Jours++;
    }
    if (messagesVieuxMoins14Jours === 0) {
      return interaction.reply("Aucun message nettoyable.").then(autoDelete);
    }

    if (interaction.channel?.type === ChannelType.GuildText) {
      await interaction.channel.bulkDelete(messagesVieuxMoins14Jours);
      return interaction.reply({
        content: "Nettoyage terminé. 🧹",
        ephemeral: true,
      });
    }
    return interaction.reply("Echec du nettoyable.").then(autoDelete);
  }
}
