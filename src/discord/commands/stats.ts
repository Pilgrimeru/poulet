import { guildSettingsService } from "@/database/services";
import { StatsTableBuilder } from "@/discord/components";
import { Command } from "@/discord/types";
import { TableImageGenerator } from "@/image-generator";
import { ApplicationCommandOptionType, ChatInputCommandInteraction, MessageFlags, MessageFlagsBitField, } from "discord.js";
import { unlinkSync } from "node:fs";

const validDateFormat = /^([0-2]\d|3[0-1])-(0[1-9]|1[0-2])-\d{4}$/;

export default class StatsCommand extends Command {
  constructor() {
    super({
      name: "stats",
      description: "affiche les stats du serveur",
      options: [
        {
          name: "debut",
          description: "format : jj-mm-aaaa",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "fin",
          description: "format : jj-mm-aaaa",
          type: ApplicationCommandOptionType.String,
          required: false,
        },
      ],
    });
  }

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const startString = interaction.options.getString("debut", true);
      const endString = interaction.options.getString("fin", false);

      if (!new RegExp(validDateFormat).exec(startString))
        return interaction.reply("format not match");

      let [year, month, day] = startString.split("-");

      const startDate = new Date(
        Number(day),
        Number(month) - 1,
        Number(year),
      ).getTime();

      let endDate = Date.now();
      if (endString?.match(validDateFormat)) {
        let [day, month, year] = endString.split("-").reverse();
        endDate = new Date(
          Number(day),
          Number(month) - 1,
          Number(year),
        ).getTime();
      }
      await interaction.deferReply({flags: MessageFlagsBitField.Flags.Ephemeral}).catch(console.error);

      const guildSettings = await guildSettingsService.getByGuildID(interaction.guildId!);
      const tableData = await StatsTableBuilder.createTopTableData(
        startDate,
        endDate,
        interaction.guild!,
        {
          blacklistChannel: guildSettings.statsBlacklistChannelIDs,
          allowDeaf: guildSettings.statsCountDeafTime,
          rankingPreference: guildSettings.statsRankingPreference,
        },
      );

      const imgName = "table-stats_" + interaction.user.id + ".png";
      await new TableImageGenerator().createImage(tableData, imgName);

      await interaction
        .editReply({
          files: ["cache/" + imgName],
        })
        .catch(console.error);

      unlinkSync("cache/" + imgName);
    } catch (error) {
      console.error("[stats] command failed", error);
      if (interaction.deferred || interaction.replied) {
        await interaction
          .editReply("Impossible de générer les stats pour le moment.")
          .catch(console.error);
      } else {
        await interaction
          .reply({
            content: "Impossible de générer les stats pour le moment.",
            flags: MessageFlags.Ephemeral,
          })
          .catch(console.error);
      }
    }
  }
}
