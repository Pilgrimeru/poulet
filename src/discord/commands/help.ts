import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CommandInteraction, EmbedBuilder, MessageComponentInteraction } from "discord.js";
import { config, i18n } from "@/app";
import { bot } from "@/app/runtime";
import { Command } from "@/discord/types";
import { componentRouter } from "@/discord/interactions";

const HELP_TTL = 120_000;

export default class HelpCommand extends Command {
  constructor() {
    super({
      name: "help",
      description: i18n.__("help.description"),
    });
  }

  async execute(interaction: CommandInteraction): Promise<void> {
    const commands = Array.from(bot.commands.values());
    const commandsPerPage = 15;
    const totalPages = Math.ceil(commands.length / commandsPerPage);
    const userId = interaction.user.id;

    let page = 1;

    const prevId = `help:${userId}:previous`;
    const nextId = `help:${userId}:next`;

    function createHelpPage(p: number): EmbedBuilder {
      const start = (p - 1) * commandsPerPage;
      return new EmbedBuilder()
        .setTitle(i18n.__mf("help.embedTitle", { botname: interaction.channel?.client.user.displayName }))
        .setDescription(`${i18n.__("help.embedDescription")} (${p}/${totalPages})`)
        .setColor(config.COLORS.MAIN)
        .addFields(
          commands.slice(start, start + commandsPerPage).map((cmd) => ({
            name: `**/${cmd.name}**`,
            value: cmd.description,
            inline: true,
          })),
        )
        .setTimestamp();
    }

    function createHelpButtons(p: number): ActionRowBuilder<ButtonBuilder> {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(prevId).setEmoji("⬅").setStyle(ButtonStyle.Secondary).setDisabled(p === 1),
        new ButtonBuilder().setCustomId(nextId).setEmoji("➡").setStyle(ButtonStyle.Secondary).setDisabled(p === totalPages),
      );
    }

    await interaction.reply({ embeds: [createHelpPage(page)], ephemeral: true });
    if (totalPages === 1) return;

    await interaction.editReply({ components: [createHelpButtons(page)] });

    function unregister() {
      componentRouter.unregister(prevId);
      componentRouter.unregister(nextId);
    }

    setTimeout(() => {
      unregister();
      if (config.AUTO_DELETE) {
        interaction.deleteReply().catch(() => undefined);
      } else {
        interaction.editReply({ components: [] }).catch(() => undefined);
      }
    }, HELP_TTL);

    async function onPage(interaction: MessageComponentInteraction, delta: number): Promise<void> {
      const next = page + delta;
      if (next < 1 || next > totalPages) { await interaction.deferUpdate(); return; }
      page = next;
      await interaction.update({ embeds: [createHelpPage(page)], components: [createHelpButtons(page)] });
    }

    componentRouter.register(prevId, (i) => onPage(i, -1));
    componentRouter.register(nextId, (i) => onPage(i, +1));
  }
}
