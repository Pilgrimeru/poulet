import { Command } from "@/discord/types";
import {
  onMainMenuSelection,
  onRuleAction,
  onRuleChannels,
} from "@/discord/commands/settings/antiSpam";
import { renderHome } from "@/discord/commands/settings/home";
import {
  SETTINGS_AS_ACTIONS_PREFIX,
  SETTINGS_AS_CHANNELS_PREFIX,
  SETTINGS_MENU_ID,
  SETTINGS_STATS_ACTIONS_ID,
  SETTINGS_STATS_CHANNELS_ID,
  SETTINGS_STATS_FREQUENCY_ID,
  SETTINGS_STATS_REPORT_ACTIONS_ID,
  SETTINGS_STATS_RANKING_ID,
  SETTINGS_STATS_REPORT_CHANNEL_ID,
  SETTINGS_STATS_TOGGLE_DEAF_ID,
} from "@/discord/commands/settings/ids";
import {
  onStatsAction,
  onStatsChannels,
  onStatsFrequency,
  onStatsRanking,
  onStatsReportAction,
  onStatsReportChannel,
  onStatsToggleDeaf,
  renderStatsHome,
} from "@/discord/commands/settings/stats";
import {
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import {
  parseRuleIDFromActionsCustomID,
  parseRuleIDFromChannelsCustomID,
} from "@/discord/commands/settings/utils";

export default class SettingsCommand extends Command {
  constructor() {
    super({
      name: "settings",
      description: "Configurer le bot pour ce serveur",
    });
  }

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "Cette commande doit etre utilisee dans un serveur.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guildID = interaction.guildId;
    await interaction.reply({
      ...(await renderHome()),
      flags: MessageFlags.Ephemeral,
    });

    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({
      time: 10 * 60 * 1000,
      filter: (componentInteraction) =>
        componentInteraction.user.id === interaction.user.id,
    });

    collector.on("collect", async (componentInteraction) => {
      if (componentInteraction.isStringSelectMenu()) {
        if (componentInteraction.customId === SETTINGS_MENU_ID) {
          await onMainMenuSelection(
            componentInteraction,
            guildID,
            async () => {
              await componentInteraction.update(await renderHome());
            },
            async () => {
              await componentInteraction.update(await renderStatsHome(guildID));
            },
          );
          return;
        }

        if (componentInteraction.customId === SETTINGS_STATS_ACTIONS_ID) {
          await onStatsAction(componentInteraction, guildID);
          return;
        }

        if (componentInteraction.customId === SETTINGS_STATS_REPORT_ACTIONS_ID) {
          await onStatsReportAction(componentInteraction, guildID);
          return;
        }

        if (componentInteraction.customId === SETTINGS_STATS_FREQUENCY_ID) {
          await onStatsFrequency(componentInteraction, guildID);
          return;
        }
        if (componentInteraction.customId === SETTINGS_STATS_RANKING_ID) {
          await onStatsRanking(componentInteraction, guildID);
          return;
        }

        if (componentInteraction.customId.startsWith(SETTINGS_AS_ACTIONS_PREFIX)) {
          const ruleID = parseRuleIDFromActionsCustomID(componentInteraction.customId);
          if (!ruleID) return;
          await onRuleAction(componentInteraction, guildID, ruleID);
        }
        return;
      }

      if (componentInteraction.isChannelSelectMenu()) {
        if (componentInteraction.customId === SETTINGS_STATS_CHANNELS_ID) {
          await onStatsChannels(componentInteraction, guildID);
          return;
        }

        if (componentInteraction.customId === SETTINGS_STATS_REPORT_CHANNEL_ID) {
          await onStatsReportChannel(componentInteraction, guildID);
          return;
        }

        if (componentInteraction.customId.startsWith(SETTINGS_AS_CHANNELS_PREFIX)) {
          const ruleID = parseRuleIDFromChannelsCustomID(componentInteraction.customId);
          if (!ruleID) return;
          await onRuleChannels(componentInteraction, guildID, ruleID);
        }
      }

      if (componentInteraction.isButton()) {
        if (componentInteraction.customId === SETTINGS_STATS_TOGGLE_DEAF_ID) {
          await onStatsToggleDeaf(componentInteraction, guildID);
          return;
        }
      }
    });

    collector.on("end", async () => {
      await interaction.editReply({ components: [] }).catch(() => undefined);
    });
  }
}
