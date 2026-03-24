import { config } from "@/app";
import { ChannelRuleMessageFilter } from "@/database/models";
import { channelRuleService } from "@/database/services";
import { ScopedSettingsIds } from "@/discord/commands/settings/ids";
import {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelSelectMenuInteraction,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

const SETTINGS_CR_EMOJIS_MODAL_PREFIX = "settings:cr:modal:emojis:";

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
        rule.reactEmojis.length > 0 ? `React: ${rule.reactEmojis.join(" ")}` : null,
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

export async function renderChannelRuleSelector(guildID: string, ids: ScopedSettingsIds) {
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

  const emojis = rule?.reactEmojis ?? [];
  const filter = rule?.reactFilter ?? ["all"];
  const autoThread = rule?.autoThread ?? false;
  const oneMessageLimit = rule?.oneMessageLimit ?? false;

  const filterLabels: Record<ChannelRuleMessageFilter, string> = {
    all: "tous les messages",
    images: "images",
    links: "liens",
  };

  const embed = new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle(`Regles - <#${channelID}>`)
    .setDescription(
      [
        `**Reactions auto:** ${emojis.length > 0 ? `${emojis.join(" ")} (filtre: ${filter.map((f) => filterLabels[f]).join(", ")})` : "desactivee"}`,
        `**Thread auto:** ${autoThread ? "active" : "desactive"}`,
        `**1 message par user:** ${oneMessageLimit ? "active" : "desactive"}`,
      ].join("\n"),
    );

  const filterMenu = new StringSelectMenuBuilder()
    .setCustomId(`${ids.CR_FILTER_PREFIX}${channelID}`)
    .setPlaceholder("Filtre des reactions")
    .setMinValues(1)
    .setMaxValues(3)
    .addOptions([
      { label: "Tous les messages texte", description: "Reagir a tous les messages", value: "all", default: filter.includes("all") },
      { label: "Images uniquement", description: "Reagir aux messages avec images", value: "images", default: filter.includes("images") },
      { label: "Liens uniquement", description: "Reagir aux messages avec liens", value: "links", default: filter.includes("links") },
    ]);

  const actionMenu = new StringSelectMenuBuilder()
    .setCustomId(`${ids.CR_ACTIONS_PREFIX}${channelID}`)
    .setPlaceholder("Actions sur le salon")
    .addOptions([
      { label: "Definir les emojis de reaction", description: "Ajouter ou modifier les emojis auto", value: "emojis" },
      { label: "Supprimer les reactions auto", description: "Retirer tous les emojis configures", value: "clear_emojis" },
      { label: autoThread ? "Desactiver thread auto" : "Activer thread auto", description: "Creer un thread sous chaque message", value: "toggle_thread" },
      { label: oneMessageLimit ? "Desactiver 1 msg/user" : "Activer 1 msg/user", description: "Supprimer les messages si le precedent existe encore", value: "toggle_one_msg" },
      { label: "Supprimer toutes les regles", description: "Retirer la configuration de ce salon", value: "delete" },
      { label: "Retour a la liste", description: "Revenir aux regles par salon", value: "back" },
    ]);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(actionMenu),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(filterMenu),
    ],
  };
}

async function openEmojisModal(interaction: StringSelectMenuInteraction, guildID: string, channelID: string, ids: ScopedSettingsIds) {
  const rule = await channelRuleService.getRuleByChannel(guildID, channelID);
  const currentEmojis = rule?.reactEmojis.join(" ") ?? "";

  const modal = new ModalBuilder()
    .setCustomId(`${SETTINGS_CR_EMOJIS_MODAL_PREFIX}${channelID}`)
    .setTitle("Configurer les reactions auto");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("emojis")
        .setLabel("Emojis (separes par des espaces)")
        .setRequired(true)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: 👍 <:MonEmoji:1486113309861220352>")
        .setValue(currentEmojis),
    ),
  );

  await interaction.showModal(modal);
  const submitted = await interaction.awaitModalSubmit({
    time: 120000,
    filter: (i) => i.customId === `${SETTINGS_CR_EMOJIS_MODAL_PREFIX}${channelID}` && i.user.id === interaction.user.id,
  }).catch(() => undefined);
  if (!submitted) return;

  const raw = submitted.fields.getTextInputValue("emojis").trim();
  const emojis = raw.split(/\s+/).filter(Boolean).slice(0, 10);

  await channelRuleService.upsertRule(guildID, channelID, { reactEmojis: emojis });
  await submitted.reply({ content: `Reactions mises a jour: ${emojis.join(" ")}`, flags: MessageFlags.Ephemeral });
  await interaction.editReply(await renderChannelRuleEditor(guildID, channelID, ids));
}

export async function onChannelRuleAction(
  interaction: StringSelectMenuInteraction,
  guildID: string,
  channelID: string,
  ids: ScopedSettingsIds,
) {
  const action = interaction.values[0];

  if (action === "emojis") {
    await openEmojisModal(interaction, guildID, channelID, ids);
    return;
  }
  if (action === "clear_emojis") {
    await channelRuleService.upsertRule(guildID, channelID, { reactEmojis: [] });
    await interaction.update(await renderChannelRuleEditor(guildID, channelID, ids));
    return;
  }
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

export async function onChannelRuleFilter(
  interaction: StringSelectMenuInteraction,
  guildID: string,
  channelID: string,
  ids: ScopedSettingsIds,
) {
  const filter = interaction.values as ChannelRuleMessageFilter[];
  await channelRuleService.upsertRule(guildID, channelID, { reactFilter: filter });
  await interaction.update(await renderChannelRuleEditor(guildID, channelID, ids));
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
