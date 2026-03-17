import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { config, i18n } from "@/app";
import { bot } from "@/app/runtime";
import { Command } from "@/discord/types";

export default class HelpCommand extends Command {
  constructor() {
    super({
      name: "help",
      description: i18n.__("help.description"),
    });
  }

  async execute(interaction: CommandInteraction) {
    let commands = Array.from(bot.commands.values());
    const commandsPerPage = 15;

    let page = 1;
    const totalPages = Math.ceil(commands.length / commandsPerPage);

    function createHelpPage(page: number): EmbedBuilder {
      const startIndex = (page - 1) * commandsPerPage;
      const endIndex = startIndex + commandsPerPage;

      const helpEmbed = new EmbedBuilder()
        .setTitle(
          i18n.__mf("help.embedTitle", {
            botname: interaction.channel?.client.user.displayName,
          }),
        )
        .setDescription(
          `${i18n.__("help.embedDescription")} (${page}/${totalPages})`,
        )
        .setColor(config.COLORS.MAIN);

      commands.slice(startIndex, endIndex).forEach((cmd) => {
        helpEmbed.addFields({
          name: `**/${cmd.name}**`,
          value: `${cmd.description}`,
          inline: true,
        });
      });
      helpEmbed.setTimestamp();

      return helpEmbed;
    }

    await interaction.reply({
      embeds: [createHelpPage(page)],
      ephemeral: true,
    });
    if (totalPages === 1) return;

    function createHelpButtons(page: number): ActionRowBuilder<ButtonBuilder> {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("previous")
          .setEmoji("⬅")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 1),
        new ButtonBuilder()
          .setCustomId("next")
          .setEmoji("➡")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages),
      );
    }

    const response = await interaction.editReply({
      components: [createHelpButtons(page)],
    });

    const collector = response.createMessageComponentCollector({
      time: 120000,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "previous" && page > 1) {
        page--;
      } else if (interaction.customId === "next" && page < totalPages) {
        page++;
      }

      interaction.editReply({
        embeds: [createHelpPage(page)],
        components: [createHelpButtons(page)],
      });
      interaction.deferUpdate();
    });

    collector.on("end", () => {
      if (config.AUTO_DELETE) {
        interaction.deleteReply();
      } else {
        interaction.editReply({ components: [] });
      }
    });
  }
}
