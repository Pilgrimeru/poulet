import { onMainMenuSelection, onRuleAction, onRuleChannels } from "@/discord/commands/settings/antiSpam";
import { onChannelRuleAction, onChannelRuleFilter, onChannelSelect } from "@/discord/commands/settings/channelRules";
import { renderHome } from "@/discord/commands/settings/home";
import { ScopedSettingsIds, scopeIds } from "@/discord/commands/settings/ids";
import {
  onStatsAction,
  onStatsChannels,
  onStatsFrequency,
  onStatsRanking,
  onStatsReportAction,
  onStatsReportChannel,
  onStatsToggleDeaf,
} from "@/discord/commands/settings/stats";
import { componentRouter } from "@/discord/interactions";
import { Command } from "@/discord/types";
import { ChatInputCommandInteraction, MessageFlags } from "discord.js";

const SETTINGS_TTL = 10 * 60 * 1000;

export default class SettingsCommand extends Command {
  constructor() {
    super({ name: "settings", description: "Configurer le bot pour ce serveur" });
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: "Cette commande doit etre utilisee dans un serveur.", flags: MessageFlags.Ephemeral });
      return;
    }

    const guildID = interaction.guildId;
    const ids = scopeIds(interaction.user.id);

    await interaction.reply({ ...(await renderHome(ids)), flags: MessageFlags.Ephemeral });

    this.registerHandlers(guildID, ids);

    setTimeout(async () => {
      this.unregisterHandlers(ids);
      await interaction.editReply({ components: [] }).catch(() => undefined);
    }, SETTINGS_TTL);
  }

  private registerHandlers(
    guildID: string,
    ids: ScopedSettingsIds,
  ): void {
    // Main navigation menu
    componentRouter.register(ids.MENU, (i) => {
      if (!i.isStringSelectMenu()) return;
      return onMainMenuSelection(i, guildID, ids);
    });

    // Stats actions
    componentRouter.register(ids.STATS_ACTIONS, (i) => {
      if (!i.isStringSelectMenu()) return;
      return onStatsAction(i, guildID, ids);
    });

    componentRouter.register(ids.STATS_REPORT_ACTIONS, (i) => {
      if (!i.isStringSelectMenu()) return;
      return onStatsReportAction(i, guildID, ids);
    });

    componentRouter.register(ids.STATS_FREQUENCY, (i) => {
      if (!i.isStringSelectMenu()) return;
      return onStatsFrequency(i, guildID, ids);
    });

    componentRouter.register(ids.STATS_RANKING, (i) => {
      if (!i.isStringSelectMenu()) return;
      return onStatsRanking(i, guildID, ids);
    });

    componentRouter.register(ids.STATS_CHANNELS, (i) => {
      if (!i.isChannelSelectMenu()) return;
      return onStatsChannels(i, guildID, ids);
    });

    componentRouter.register(ids.STATS_REPORT_CHANNEL, (i) => {
      if (!i.isChannelSelectMenu()) return;
      return onStatsReportChannel(i, guildID, ids);
    });

    componentRouter.register(ids.STATS_TOGGLE_DEAF, (i) => {
      if (!i.isButton()) return;
      return onStatsToggleDeaf(i, guildID, ids);
    });

    // Anti-spam prefix handlers
    componentRouter.registerPrefix(ids.AS_ACTIONS_PREFIX, (i) => {
      if (!i.isStringSelectMenu()) return;
      const ruleID = i.customId.slice(ids.AS_ACTIONS_PREFIX.length);
      if (!ruleID) return;
      return onRuleAction(i, guildID, ruleID, ids);
    });

    componentRouter.registerPrefix(ids.AS_CHANNELS_PREFIX, (i) => {
      if (!i.isChannelSelectMenu()) return;
      const ruleID = i.customId.slice(ids.AS_CHANNELS_PREFIX.length);
      if (!ruleID) return;
      return onRuleChannels(i, guildID, ruleID, ids);
    });

    // Channel rules handlers
    componentRouter.register(ids.CR_CHANNEL_SELECT, (i) => {
      if (!i.isChannelSelectMenu()) return;
      return onChannelSelect(i, guildID, ids);
    });

    componentRouter.registerPrefix(ids.CR_ACTIONS_PREFIX, (i) => {
      if (!i.isStringSelectMenu()) return;
      const channelID = i.customId.slice(ids.CR_ACTIONS_PREFIX.length);
      if (!channelID) return;
      return onChannelRuleAction(i, guildID, channelID, ids);
    });

    componentRouter.registerPrefix(ids.CR_FILTER_PREFIX, (i) => {
      if (!i.isStringSelectMenu()) return;
      const channelID = i.customId.slice(ids.CR_FILTER_PREFIX.length);
      if (!channelID) return;
      return onChannelRuleFilter(i, guildID, channelID, ids);
    });
  }

  private unregisterHandlers(ids: ScopedSettingsIds): void {
    componentRouter.unregister(ids.MENU);
    componentRouter.unregister(ids.STATS_ACTIONS);
    componentRouter.unregister(ids.STATS_REPORT_ACTIONS);
    componentRouter.unregister(ids.STATS_FREQUENCY);
    componentRouter.unregister(ids.STATS_RANKING);
    componentRouter.unregister(ids.STATS_CHANNELS);
    componentRouter.unregister(ids.STATS_REPORT_CHANNEL);
    componentRouter.unregister(ids.STATS_TOGGLE_DEAF);
    componentRouter.unregisterPrefix(ids.AS_ACTIONS_PREFIX);
    componentRouter.unregisterPrefix(ids.AS_CHANNELS_PREFIX);
    componentRouter.unregister(ids.CR_CHANNEL_SELECT);
    componentRouter.unregisterPrefix(ids.CR_ACTIONS_PREFIX);
    componentRouter.unregisterPrefix(ids.CR_FILTER_PREFIX);
  }
}
