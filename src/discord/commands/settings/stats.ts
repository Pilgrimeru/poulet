import { config } from "@/app";
import { guildSettingsService } from "@/database/services";
import { renderHome } from "@/discord/commands/settings/home";
import {
  SETTINGS_STATS_ACTIONS_ID,
  SETTINGS_STATS_CHANNELS_ID,
  SETTINGS_STATS_FREQUENCY_ID,
  SETTINGS_STATS_RANKING_ID,
  SETTINGS_STATS_REPORT_ACTIONS_ID,
  SETTINGS_STATS_REPORT_CHANNEL_ID,
  SETTINGS_STATS_TOGGLE_DEAF_ID,
} from "@/discord/commands/settings/ids";
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

export async function renderStatsHome(guildID: string) {
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
    .setCustomId(SETTINGS_STATS_ACTIONS_ID)
    .setPlaceholder("Actions stats")
    .addOptions([
      {
        label: "Configurer Rapport",
        description: "Frequence auto et salon recap",
        value: "nav:report",
      },
      {
        label: "Retour accueil",
        description: "Revenir au menu principal",
        value: "nav:home",
      },
    ]);

  const toggleDeafButton = new ButtonBuilder()
    .setCustomId(SETTINGS_STATS_TOGGLE_DEAF_ID)
    .setLabel(settings.statsCountDeafTime ? "Exclure casque coupe" : "Inclure casque coupe")
    .setStyle(settings.statsCountDeafTime ? ButtonStyle.Secondary : ButtonStyle.Primary);

  const rankingMenu = new StringSelectMenuBuilder()
    .setCustomId(SETTINGS_STATS_RANKING_ID)
    .setPlaceholder("Preference de classement")
    .addOptions([
      {
        label: "Temps vocal",
        description: "Classement priorise le temps vocal",
        value: "voice",
        default: settings.statsRankingPreference === "voice",
      },
      {
        label: "Messages",
        description: "Classement priorise le nombre de messages",
        value: "messages",
        default: settings.statsRankingPreference === "messages",
      },
    ]);

  const channelsMenu = new ChannelSelectMenuBuilder()
    .setCustomId(SETTINGS_STATS_CHANNELS_ID)
    .setPlaceholder("Choisir les salons exclus des stats")
    .setChannelTypes([
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildVoice,
      ChannelType.GuildForum,
    ])
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

export async function renderStatsReport(guildID: string) {
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
    .setCustomId(SETTINGS_STATS_REPORT_ACTIONS_ID)
    .setPlaceholder("Actions rapport stats")
    .addOptions([
      {
        label: "Retour stats",
        description: "Revenir a la page Stats",
        value: "nav:stats",
      },
    ]);

  const frequencyMenu = new StringSelectMenuBuilder()
    .setCustomId(SETTINGS_STATS_FREQUENCY_ID)
    .setPlaceholder("Frequence des envois auto")
    .addOptions([
      {
        label: "Desactive",
        description: "Aucun envoi automatique",
        value: "disabled",
        default: settings.statsAutoFrequency === "disabled",
      },
      {
        label: "Tous les jours",
        description: "Envoi quotidien",
        value: "daily",
        default: settings.statsAutoFrequency === "daily",
      },
      {
        label: "Toutes les semaines",
        description: "Envoi hebdomadaire (lundi)",
        value: "weekly",
        default: settings.statsAutoFrequency === "weekly",
      },
      {
        label: "Tous les mois",
        description: "Envoi mensuel (le 1er)",
        value: "monthly",
        default: settings.statsAutoFrequency === "monthly",
      },
    ]);

  const reportChannelMenu = new ChannelSelectMenuBuilder()
    .setCustomId(SETTINGS_STATS_REPORT_CHANNEL_ID)
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

export async function onStatsAction(interaction: StringSelectMenuInteraction, guildID: string) {
  const action = interaction.values[0];
  if (action === "nav:report") {
    await interaction.update(await renderStatsReport(guildID));
    return;
  }

  if (action === "nav:home") {
    await interaction.update(await renderHome());
  }
}

export async function onStatsToggleDeaf(interaction: ButtonInteraction, guildID: string) {
  const settings = await guildSettingsService.getByGuildID(guildID);
  await guildSettingsService.updateByGuildID(guildID, {
    statsCountDeafTime: !settings.statsCountDeafTime,
  });
  await interaction.update(await renderStatsHome(guildID));
}

export async function onStatsReportAction(interaction: StringSelectMenuInteraction, guildID: string) {
  const action = interaction.values[0];
  if (action === "nav:stats") {
    await interaction.update(await renderStatsHome(guildID));
  }
}

export async function onStatsChannels(
  interaction: ChannelSelectMenuInteraction,
  guildID: string,
) {
  await guildSettingsService.updateByGuildID(guildID, {
    statsBlacklistChannelIDs: interaction.values,
  });
  await interaction.update(await renderStatsHome(guildID));
}

export async function onStatsReportChannel(
  interaction: ChannelSelectMenuInteraction,
  guildID: string,
) {
  await guildSettingsService.updateByGuildID(guildID, {
    statsReportChannelID: interaction.values[0] ?? "",
  });
  await interaction.update(await renderStatsReport(guildID));
}

export async function onStatsFrequency(
  interaction: StringSelectMenuInteraction,
  guildID: string,
) {
  const value = interaction.values[0];
  if (
    value !== "disabled" &&
    value !== "daily" &&
    value !== "weekly" &&
    value !== "monthly"
  ) {
    return;
  }

  await guildSettingsService.updateByGuildID(guildID, {
    statsAutoFrequency: value,
  });
  await interaction.update(await renderStatsReport(guildID));
}

export async function onStatsRanking(
  interaction: StringSelectMenuInteraction,
  guildID: string,
) {
  const value = interaction.values[0];
  if (value !== "voice" && value !== "messages") {
    return;
  }

  await guildSettingsService.updateByGuildID(guildID, {
    statsRankingPreference: value,
  });
  await interaction.update(await renderStatsHome(guildID));
}
