import { config } from "@/app";
import { spamFilterRuleService } from "@/api";
import {
  SETTINGS_AS_CREATE_MODAL_ID,
  SETTINGS_AS_META_MODAL_PREFIX,
  SETTINGS_AS_THRESHOLDS_MODAL_PREFIX,
  ScopedSettingsIds,
} from "@/discord/commands/settings/ids";
import { isPositiveInt } from "@/discord/commands/settings/utils";
import { invalidateSpamCheckers } from "@/discord/components";
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

export async function renderAntiSpamHome(guildID: string, ids: ScopedSettingsIds) {
  const rules = await spamFilterRuleService.getRulesByGuildID(guildID);
  const embed = new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle("Settings - Anti Spam")
    .setDescription(
      [
        "Cree un filtre ou modifie un filtre existant.",
        `Filtres actifs: ${rules.filter((r) => r.enabled).length}/${rules.length}`,
      ].join("\n"),
    );

  const options = [
    { label: "Nouveau filtre", description: "Creer un filtre anti-spam", value: "as:create" },
    ...rules.slice(0, 20).map((rule) => ({
      label: `${rule.enabled ? "ON" : "OFF"} - ${rule.name}`.slice(0, 100),
      description: `${rule.mode} | ${rule.messageLimit} msg/${rule.intervalInSec}s`.slice(0, 100),
      value: `as:edit:${rule.id}`,
    })),
    { label: "Retour accueil", description: "Revenir au menu principal", value: "nav:home" },
  ];

  const menu = new StringSelectMenuBuilder()
    .setCustomId(ids.MENU)
    .setPlaceholder("Anti-spam")
    .addOptions(options);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
  };
}

export async function renderRuleEditor(guildID: string, ruleID: string, ids: ScopedSettingsIds) {
  const rule = await spamFilterRuleService.getRuleByID(guildID, ruleID);
  if (!rule) return renderAntiSpamHome(guildID, ids);

  const embed = new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle(`Filtre - ${rule.name}`)
    .setDescription(
      [
        rule.description || "Sans description",
        `Etat: ${rule.enabled ? "active" : "desactive"}`,
        `Mode: ${rule.mode}`,
        `Limite: ${rule.messageLimit} messages en ${rule.intervalInSec} secondes`,
        `Sanction: timeout ${rule.punishmentDurationInSec} secondes`,
        `${rule.mode === "blacklist" ? "Salons ignores" : "Salons surveilles"}: ${rule.channelIDs.length}`,
      ].join("\n"),
    );

  const actionMenu = new StringSelectMenuBuilder()
    .setCustomId(`${ids.AS_ACTIONS_PREFIX}${rule.id}`)
    .setPlaceholder("Actions sur le filtre")
    .addOptions([
      { label: "Modifier nom/description/mode", description: "Popup de configuration du filtre", value: "meta" },
      { label: "Modifier seuil anti-spam", description: "Limiter messages, fenetre et duree de sanction", value: "thresholds" },
      { label: rule.enabled ? "Desactiver le filtre" : "Activer le filtre", description: "Toggle actif/inactif", value: "toggle" },
      { label: "Supprimer le filtre", description: "Suppression definitive", value: "delete" },
      { label: "Retour a la liste", description: "Revenir aux filtres anti-spam", value: "back" },
    ]);

  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId(`${ids.AS_CHANNELS_PREFIX}${rule.id}`)
    .setPlaceholder("Choisir les salons du filtre")
    .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildForum])
    .setMinValues(0)
    .setMaxValues(25);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(actionMenu),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelMenu),
    ],
  };
}

async function openCreateRuleModal(interaction: StringSelectMenuInteraction, guildID: string, ids: ScopedSettingsIds) {
  const modal = new ModalBuilder().setCustomId(SETTINGS_AS_CREATE_MODAL_ID).setTitle("Nouveau filtre anti-spam");
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("name").setLabel("Nom du filtre").setRequired(true).setStyle(TextInputStyle.Short).setPlaceholder("Ex: Filtre general"),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("mode").setLabel("Mode (whitelist ou blacklist)").setRequired(true).setStyle(TextInputStyle.Short).setPlaceholder("blacklist"),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("message_limit").setLabel("Nombre max de messages").setRequired(true).setStyle(TextInputStyle.Short).setPlaceholder("Ex: 3"),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("interval_sec").setLabel("Fenetre de temps (secondes)").setRequired(true).setStyle(TextInputStyle.Short).setPlaceholder("Ex: 3"),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("timeout_sec").setLabel("Duree du timeout (secondes)").setRequired(true).setStyle(TextInputStyle.Short).setPlaceholder("Ex: 300"),
    ),
  );

  await interaction.showModal(modal);
  const submitted = await interaction.awaitModalSubmit({
    time: 120000,
    filter: (i) => i.customId === SETTINGS_AS_CREATE_MODAL_ID && i.user.id === interaction.user.id,
  }).catch(() => undefined);
  if (!submitted) return;

  const rawMode = submitted.fields.getTextInputValue("mode").trim().toLowerCase();
  const messageLimitRaw = submitted.fields.getTextInputValue("message_limit").trim();
  const intervalRaw = submitted.fields.getTextInputValue("interval_sec").trim();
  const timeoutRaw = submitted.fields.getTextInputValue("timeout_sec").trim();

  if ((rawMode !== "whitelist" && rawMode !== "blacklist") || !isPositiveInt(messageLimitRaw) || !isPositiveInt(intervalRaw) || !isPositiveInt(timeoutRaw)) {
    await submitted.reply({ content: "Valeurs invalides. Mode: whitelist/blacklist. Les 3 champs de seuil attendent des entiers positifs (secondes pour les durees).", flags: MessageFlags.Ephemeral });
    return;
  }

  const created = await spamFilterRuleService.createRule({
    guildID,
    name: submitted.fields.getTextInputValue("name").trim(),
    description: "",
    mode: rawMode,
    channelIDs: [],
    enabled: true,
    messageLimit: Number(messageLimitRaw),
    intervalInSec: Number(intervalRaw),
    punishmentDurationInSec: Number(timeoutRaw),
  });
  invalidateSpamCheckers(guildID);
  await submitted.reply({ content: "Filtre cree. Tu peux maintenant lui associer des salons.", flags: MessageFlags.Ephemeral });
  await interaction.editReply(await renderRuleEditor(guildID, created.id, ids));
}

async function openMetaModal(interaction: StringSelectMenuInteraction, guildID: string, ruleID: string, ids: ScopedSettingsIds) {
  const rule = await spamFilterRuleService.getRuleByID(guildID, ruleID);
  if (!rule) return;

  const modal = new ModalBuilder().setCustomId(`${SETTINGS_AS_META_MODAL_PREFIX}${ruleID}`).setTitle("Modifier le filtre");
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("name").setLabel("Nom du filtre").setRequired(true).setStyle(TextInputStyle.Short).setValue(rule.name),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("description").setLabel("Description").setRequired(false).setStyle(TextInputStyle.Short).setValue(rule.description || ""),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("mode").setLabel("Mode (whitelist ou blacklist)").setRequired(true).setStyle(TextInputStyle.Short).setValue(rule.mode),
    ),
  );

  await interaction.showModal(modal);
  const submitted = await interaction.awaitModalSubmit({
    time: 120000,
    filter: (i) => i.customId === `${SETTINGS_AS_META_MODAL_PREFIX}${ruleID}` && i.user.id === interaction.user.id,
  }).catch(() => undefined);
  if (!submitted) return;

  const rawMode = submitted.fields.getTextInputValue("mode").trim().toLowerCase();
  if (rawMode !== "whitelist" && rawMode !== "blacklist") {
    await submitted.reply({ content: "Mode invalide. Valeurs autorisees: whitelist ou blacklist.", flags: MessageFlags.Ephemeral });
    return;
  }

  await spamFilterRuleService.updateRule(guildID, ruleID, {
    name: submitted.fields.getTextInputValue("name").trim(),
    description: submitted.fields.getTextInputValue("description").trim(),
    mode: rawMode,
  });
  invalidateSpamCheckers(guildID);
  await submitted.reply({ content: "Filtre mis a jour.", flags: MessageFlags.Ephemeral });
  await interaction.editReply(await renderRuleEditor(guildID, ruleID, ids));
}

async function openThresholdModal(interaction: StringSelectMenuInteraction, guildID: string, ruleID: string, ids: ScopedSettingsIds) {
  const rule = await spamFilterRuleService.getRuleByID(guildID, ruleID);
  if (!rule) return;

  const modal = new ModalBuilder().setCustomId(`${SETTINGS_AS_THRESHOLDS_MODAL_PREFIX}${ruleID}`).setTitle("Modifier les seuils anti-spam");
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("message_limit").setLabel("Nombre max de messages").setRequired(true).setStyle(TextInputStyle.Short).setValue(String(rule.messageLimit)),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("interval_sec").setLabel("Fenetre de temps (secondes)").setRequired(true).setStyle(TextInputStyle.Short).setValue(String(rule.intervalInSec)),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("timeout_sec").setLabel("Duree du timeout (secondes)").setRequired(true).setStyle(TextInputStyle.Short).setValue(String(rule.punishmentDurationInSec)),
    ),
  );

  await interaction.showModal(modal);
  const submitted = await interaction.awaitModalSubmit({
    time: 120000,
    filter: (i) => i.customId === `${SETTINGS_AS_THRESHOLDS_MODAL_PREFIX}${ruleID}` && i.user.id === interaction.user.id,
  }).catch(() => undefined);
  if (!submitted) return;

  const messageLimitRaw = submitted.fields.getTextInputValue("message_limit").trim();
  const intervalRaw = submitted.fields.getTextInputValue("interval_sec").trim();
  const timeoutRaw = submitted.fields.getTextInputValue("timeout_sec").trim();

  if (!isPositiveInt(messageLimitRaw) || !isPositiveInt(intervalRaw) || !isPositiveInt(timeoutRaw)) {
    await submitted.reply({ content: "Valeurs invalides. Les 3 champs attendent des entiers positifs (secondes pour les durees).", flags: MessageFlags.Ephemeral });
    return;
  }

  await spamFilterRuleService.updateRule(guildID, ruleID, {
    messageLimit: Number(messageLimitRaw),
    intervalInSec: Number(intervalRaw),
    punishmentDurationInSec: Number(timeoutRaw),
  });
  invalidateSpamCheckers(guildID);
  await submitted.reply({ content: "Seuil mis a jour.", flags: MessageFlags.Ephemeral });
  await interaction.editReply(await renderRuleEditor(guildID, ruleID, ids));
}

export async function onRuleAction(
  interaction: StringSelectMenuInteraction,
  guildID: string,
  ruleID: string,
  ids: ScopedSettingsIds,
) {
  const action = interaction.values[0];
  if (action === "meta") { await openMetaModal(interaction, guildID, ruleID, ids); return; }
  if (action === "thresholds") { await openThresholdModal(interaction, guildID, ruleID, ids); return; }
  if (action === "toggle") {
    const rule = await spamFilterRuleService.getRuleByID(guildID, ruleID);
    if (!rule) return;
    await spamFilterRuleService.updateRule(guildID, ruleID, { enabled: !rule.enabled });
    invalidateSpamCheckers(guildID);
    await interaction.update(await renderRuleEditor(guildID, ruleID, ids));
    return;
  }
  if (action === "delete") {
    await spamFilterRuleService.deleteRule(guildID, ruleID);
    invalidateSpamCheckers(guildID);
    await interaction.update(await renderAntiSpamHome(guildID, ids));
    return;
  }
  await interaction.update(await renderAntiSpamHome(guildID, ids));
}

export async function onRuleChannels(
  interaction: ChannelSelectMenuInteraction,
  guildID: string,
  ruleID: string,
  ids: ScopedSettingsIds,
) {
  await spamFilterRuleService.updateRule(guildID, ruleID, { channelIDs: interaction.values });
  invalidateSpamCheckers(guildID);
  await interaction.update(await renderRuleEditor(guildID, ruleID, ids));
}

export async function onMainMenuSelection(
  interaction: StringSelectMenuInteraction,
  guildID: string,
  ids: ScopedSettingsIds,
) {
  const value = interaction.values[0];
  if (value === "anti_spam") { await interaction.update(await renderAntiSpamHome(guildID, ids)); return; }
  if (value === "stats") { await interaction.update(await renderStatsHomeImport(guildID, ids)); return; }
  if (value === "nav:home") { await interaction.update(await renderHomeImport(ids)); return; }
  if (value === "as:create") { await openCreateRuleModal(interaction, guildID, ids); return; }
  if (value.startsWith("as:edit:")) {
    const ruleID = value.slice("as:edit:".length);
    await interaction.update(await renderRuleEditor(guildID, ruleID, ids));
    return;
  }
  // Channel rules navigation (delegated from main menu)
  const { onChannelRulesMenuSelection } = await import("@/discord/commands/settings/channelRules");
  await onChannelRulesMenuSelection(interaction, guildID, ids);
}

// Lazy imports to avoid circular dependency
async function renderStatsHomeImport(guildID: string, ids: ScopedSettingsIds) {
  const { renderStatsHome } = await import("@/discord/commands/settings/stats");
  return renderStatsHome(guildID, ids);
}

async function renderHomeImport(ids: ScopedSettingsIds) {
  const { renderHome } = await import("@/discord/commands/settings/home");
  return renderHome(ids);
}
