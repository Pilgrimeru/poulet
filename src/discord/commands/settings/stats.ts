import { config } from "@/app";
import { guildSettingsService } from "@/api";
import { renderHome } from "@/discord/commands/settings/home";
import { ScopedSettingsIds } from "@/discord/commands/settings/ids";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelSelectMenuInteraction,
  ChannelType,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";

export async function renderStatsHome(guildID: string, ids: ScopedSettingsIds) {
  const settings = await guildSettingsService.getByGuildID(guildID);
  const embed = new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle("Settings - Stats")
    .setDescription(
      [
        `Salons exclus des stats: ${settings.statsBlacklistChannelIDs.length}`,
        `Temps vocal avec casque coupe: ${settings.statsCountDeafTime ? "inclus" : "exclu"}`,
        "Rapport: configuration disponible dans la sous-page Rapport",
      ].join("\n"),
    );

  const actionMenu = new StringSelectMenuBuilder()
    .setCustomId(ids.STATS_ACTIONS)
    .setPlaceholder("Actions stats")
    .addOptions([
      { label: "Configurer Rapport", description: "Frequence auto et salon recap", value: "nav:report" },
      { label: "Retour accueil", description: "Revenir au menu principal", value: "nav:home" },
    ]);

  const toggleDeafButton = new ButtonBuilder()
    .setCustomId(ids.STATS_TOGGLE_DEAF)
    .setLabel(settings.statsCountDeafTime ? "Exclure casque coupe" : "Inclure casque coupe")
    .setStyle(settings.statsCountDeafTime ? ButtonStyle.Secondary : ButtonStyle.Primary);

  const rankingMenu = new StringSelectMenuBuilder()
    .setCustomId(ids.STATS_RANKING)
    .setPlaceholder("Preference de classement")
    .addOptions([
      { label: "Temps vocal", description: "Classement priorise le temps vocal", value: "voice", default: settings.statsRankingPreference === "voice" },
      { label: "Messages", description: "Classement priorise le nombre de messages", value: "messages", default: settings.statsRankingPreference === "messages" },
    ]);

  const channelsMenu = new ChannelSelectMenuBuilder()
    .setCustomId(ids.STATS_CHANNELS)
    .setPlaceholder("Choisir les salons exclus des stats")
    .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildForum])
    .setMinValues(0)
    .setMaxValues(25);
  if (settings.statsBlacklistChannelIDs.length > 0) {
    channelsMenu.setDefaultChannels(settings.statsBlacklistChannelIDs);
  }

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(actionMenu),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(rankingMenu),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelsMenu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(toggleDeafButton),
    ],
  };
}

export async function renderStatsReport(guildID: string, ids: ScopedSettingsIds) {
  const settings = await guildSettingsService.getByGuildID(guildID);
  const embed = new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle("Settings - Stats - Rapport")
    .setDescription(
      [
        `Frequence auto: ${settings.statsAutoFrequency}`,
        `Salon recap auto: ${settings.statsReportChannelID ? `<#${settings.statsReportChannelID}>` : "non defini"}`,
      ].join("\n"),
    );

  const actionMenu = new StringSelectMenuBuilder()
    .setCustomId(ids.STATS_REPORT_ACTIONS)
    .setPlaceholder("Actions rapport stats")
    .addOptions([{ label: "Retour stats", description: "Revenir a la page Stats", value: "nav:stats" }]);

  const frequencyMenu = new StringSelectMenuBuilder()
    .setCustomId(ids.STATS_FREQUENCY)
    .setPlaceholder("Frequence des envois auto")
    .addOptions([
      { label: "Desactive", description: "Aucun envoi automatique", value: "disabled", default: settings.statsAutoFrequency === "disabled" },
      { label: "Tous les jours", description: "Envoi quotidien", value: "daily", default: settings.statsAutoFrequency === "daily" },
      { label: "Toutes les semaines", description: "Envoi hebdomadaire (lundi)", value: "weekly", default: settings.statsAutoFrequency === "weekly" },
      { label: "Tous les mois", description: "Envoi mensuel (le 1er)", value: "monthly", default: settings.statsAutoFrequency === "monthly" },
    ]);

  const reportChannelMenu = new ChannelSelectMenuBuilder()
    .setCustomId(ids.STATS_REPORT_CHANNEL)
    .setPlaceholder("Choisir le salon du recap stats auto")
    .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
    .setMinValues(1)
    .setMaxValues(1);

  if (settings.statsReportChannelID) {
    reportChannelMenu.setDefaultChannels(settings.statsReportChannelID);
  }

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(actionMenu),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(frequencyMenu),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(reportChannelMenu),
    ],
  };
}

export async function onStatsAction(
  interaction: StringSelectMenuInteraction,
  guildID: string,
  ids: ScopedSettingsIds,
) {
  const action = interaction.values[0];
  if (action === "nav:report") {
    await interaction.update(await renderStatsReport(guildID, ids));
    return;
  }
  if (action === "nav:home") {
    await interaction.update(await renderHome(ids));
  }
}

export async function onStatsToggleDeaf(interaction: ButtonInteraction, guildID: string, ids: ScopedSettingsIds) {
  const settings = await guildSettingsService.getByGuildID(guildID);
  await guildSettingsService.updateByGuildID(guildID, { statsCountDeafTime: !settings.statsCountDeafTime });
  await interaction.update(await renderStatsHome(guildID, ids));
}

export async function onStatsReportAction(
  interaction: StringSelectMenuInteraction,
  guildID: string,
  ids: ScopedSettingsIds,
) {
  const action = interaction.values[0];
  if (action === "nav:stats") {
    await interaction.update(await renderStatsHome(guildID, ids));
  }
}

export async function onStatsChannels(interaction: ChannelSelectMenuInteraction, guildID: string, ids: ScopedSettingsIds) {
  await guildSettingsService.updateByGuildID(guildID, { statsBlacklistChannelIDs: interaction.values });
  await interaction.update(await renderStatsHome(guildID, ids));
}

export async function onStatsReportChannel(interaction: ChannelSelectMenuInteraction, guildID: string, ids: ScopedSettingsIds) {
  await guildSettingsService.updateByGuildID(guildID, { statsReportChannelID: interaction.values[0] ?? "" });
  await interaction.update(await renderStatsReport(guildID, ids));
}

export async function onStatsFrequency(interaction: StringSelectMenuInteraction, guildID: string, ids: ScopedSettingsIds) {
  const value = interaction.values[0];
  if (value !== "disabled" && value !== "daily" && value !== "weekly" && value !== "monthly") return;
  await guildSettingsService.updateByGuildID(guildID, { statsAutoFrequency: value });
  await interaction.update(await renderStatsReport(guildID, ids));
}

export async function onStatsRanking(interaction: StringSelectMenuInteraction, guildID: string, ids: ScopedSettingsIds) {
  const value = interaction.values[0];
  if (value !== "voice" && value !== "messages") return;
  await guildSettingsService.updateByGuildID(guildID, { statsRankingPreference: value });
  await interaction.update(await renderStatsHome(guildID, ids));
}
