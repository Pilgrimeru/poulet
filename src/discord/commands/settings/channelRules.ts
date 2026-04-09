import { config } from "@/app";
import { channelRuleService } from "@/api";
import { ScopedSettingsIds } from "@/discord/commands/settings/ids";
import {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelSelectMenuInteraction,
  ChannelType,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";

export async function renderChannelRulesHome(guildID: string, ids: ScopedSettingsIds) {
  const rules = await channelRuleService.getRulesByGuildID(guildID);
  const embed = new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle("Settings - Regles par salon")
    .setDescription(
      [
        "Selectionne un salon pour configurer ses regles.",
        `Salons configures: ${rules.length}`,
      ].join("\n"),
    );

  const options = [
    ...rules.slice(0, 23).map((rule) => ({
      label: `#${rule.channelID}`,
      description: [
        rule.autoThread ? "Thread auto" : null,
        rule.oneMessageLimit ? "1 msg/user" : null,
      ]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 100) || "Aucune regle active",
      value: `cr:edit:${rule.channelID}`,
    })),
    { label: "Configurer un salon", description: "Selectionner un salon pour creer ou modifier ses regles", value: "cr:select" },
    { label: "Retour accueil", description: "Revenir au menu principal", value: "nav:home" },
  ];

  const menu = new StringSelectMenuBuilder()
    .setCustomId(ids.MENU)
    .setPlaceholder("Regles par salon")
    .addOptions(options);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
  };
}

export async function renderChannelRuleSelector(_guildID: string, ids: ScopedSettingsIds) {
  const embed = new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle("Settings - Regles par salon")
    .setDescription("Selectionne le salon a configurer.");

  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId(ids.CR_CHANNEL_SELECT)
    .setPlaceholder("Choisir un salon")
    .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
    .setMinValues(1)
    .setMaxValues(1);

  const backMenu = new StringSelectMenuBuilder()
    .setCustomId(ids.MENU)
    .setPlaceholder("Navigation")
    .addOptions([{ label: "Retour a la liste", description: "Revenir aux regles par salon", value: "nav:cr_home" }]);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelMenu),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(backMenu),
    ],
  };
}

export async function renderChannelRuleEditor(guildID: string, channelID: string, ids: ScopedSettingsIds) {
  const rule = await channelRuleService.getRuleByChannel(guildID, channelID);

  const autoThread = rule?.autoThread ?? false;
  const oneMessageLimit = rule?.oneMessageLimit ?? false;

  const embed = new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle(`Regles - <#${channelID}>`)
    .setDescription(
      [
        `**Thread auto:** ${autoThread ? "active" : "desactive"}`,
        `**1 message par user:** ${oneMessageLimit ? "active" : "desactive"}`,
      ].join("\n"),
    );

  const actionMenu = new StringSelectMenuBuilder()
    .setCustomId(`${ids.CR_ACTIONS_PREFIX}${channelID}`)
    .setPlaceholder("Actions sur le salon")
    .addOptions([
      { label: autoThread ? "Desactiver thread auto" : "Activer thread auto", description: "Creer un thread sous chaque message", value: "toggle_thread" },
      { label: oneMessageLimit ? "Desactiver 1 msg/user" : "Activer 1 msg/user", description: "Supprimer les messages si le precedent existe encore", value: "toggle_one_msg" },
      { label: "Supprimer toutes les regles", description: "Retirer la configuration de ce salon", value: "delete" },
      { label: "Retour a la liste", description: "Revenir aux regles par salon", value: "back" },
    ]);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(actionMenu),
    ],
  };
}

export async function onChannelRuleAction(
  interaction: StringSelectMenuInteraction,
  guildID: string,
  channelID: string,
  ids: ScopedSettingsIds,
) {
  const action = interaction.values[0];

  if (action === "toggle_thread") {
    const rule = await channelRuleService.getRuleByChannel(guildID, channelID);
    await channelRuleService.upsertRule(guildID, channelID, { autoThread: !(rule?.autoThread ?? false) });
    await interaction.update(await renderChannelRuleEditor(guildID, channelID, ids));
    return;
  }
  if (action === "toggle_one_msg") {
    const rule = await channelRuleService.getRuleByChannel(guildID, channelID);
    await channelRuleService.upsertRule(guildID, channelID, { oneMessageLimit: !(rule?.oneMessageLimit ?? false) });
    await interaction.update(await renderChannelRuleEditor(guildID, channelID, ids));
    return;
  }
  if (action === "delete") {
    await channelRuleService.deleteRule(guildID, channelID);
    await interaction.update(await renderChannelRulesHome(guildID, ids));
    return;
  }
  await interaction.update(await renderChannelRulesHome(guildID, ids));
}

export async function onChannelSelect(
  interaction: ChannelSelectMenuInteraction,
  guildID: string,
  ids: ScopedSettingsIds,
) {
  const channelID = interaction.values[0];
  if (!channelID) return;
  await interaction.update(await renderChannelRuleEditor(guildID, channelID, ids));
}

export async function onChannelRulesMenuSelection(
  interaction: StringSelectMenuInteraction,
  guildID: string,
  ids: ScopedSettingsIds,
) {
  const value = interaction.values[0];

  if (value === "channel_rules") {
    await interaction.update(await renderChannelRulesHome(guildID, ids));
    return;
  }
  if (value === "cr:select") {
    await interaction.update(await renderChannelRuleSelector(guildID, ids));
    return;
  }
  if (value === "nav:cr_home") {
    await interaction.update(await renderChannelRulesHome(guildID, ids));
    return;
  }
  if (value.startsWith("cr:edit:")) {
    const channelID = value.slice("cr:edit:".length);
    await interaction.update(await renderChannelRuleEditor(guildID, channelID, ids));
  }
}
