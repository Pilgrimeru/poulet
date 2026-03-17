import { config } from "@/app";
import { spamFilterRuleService } from "@/database/services";
import {
  SETTINGS_AS_ACTIONS_PREFIX,
  SETTINGS_AS_CHANNELS_PREFIX,
  SETTINGS_AS_CREATE_MODAL_ID,
  SETTINGS_AS_META_MODAL_PREFIX,
  SETTINGS_AS_THRESHOLDS_MODAL_PREFIX,
  SETTINGS_MENU_ID,
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

export async function renderAntiSpamHome(guildID: string) {
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
    {
      label: "Nouveau filtre",
      description: "Creer un filtre anti-spam",
      value: "as:create",
    },
    ...rules.slice(0, 20).map((rule) => ({
      label: `${rule.enabled ? "ON" : "OFF"} - ${rule.name}`.slice(0, 100),
      description: `${rule.mode} | ${rule.messageLimit} msg/${rule.intervalInSec}s`.slice(
        0,
        100,
      ),
      value: `as:edit:${rule.id}`,
    })),
    {
      label: "Retour accueil",
      description: "Revenir au menu principal",
      value: "nav:home",
    },
  ];

  const menu = new StringSelectMenuBuilder()
    .setCustomId(SETTINGS_MENU_ID)
    .setPlaceholder("Anti-spam")
    .addOptions(options);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
  };
}

export async function renderRuleEditor(guildID: string, ruleID: string) {
  const rule = await spamFilterRuleService.getRuleByID(guildID, ruleID);
  if (!rule) return renderAntiSpamHome(guildID);

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
    .setCustomId(`${SETTINGS_AS_ACTIONS_PREFIX}${rule.id}`)
    .setPlaceholder("Actions sur le filtre")
    .addOptions([
      {
        label: "Modifier nom/description/mode",
        description: "Popup de configuration du filtre",
        value: "meta",
      },
      {
        label: "Modifier seuil anti-spam",
        description: "Limiter messages, fenetre et duree de sanction",
        value: "thresholds",
      },
      {
        label: rule.enabled ? "Desactiver le filtre" : "Activer le filtre",
        description: "Toggle actif/inactif",
        value: "toggle",
      },
      {
        label: "Supprimer le filtre",
        description: "Suppression definitive",
        value: "delete",
      },
      {
        label: "Retour a la liste",
        description: "Revenir aux filtres anti-spam",
        value: "back",
      },
    ]);

  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId(`${SETTINGS_AS_CHANNELS_PREFIX}${rule.id}`)
    .setPlaceholder("Choisir les salons du filtre")
    .setChannelTypes([
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildVoice,
      ChannelType.GuildForum,
    ])
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

async function openCreateRuleModal(interaction: StringSelectMenuInteraction, guildID: string) {
  const modal = new ModalBuilder()
    .setCustomId(SETTINGS_AS_CREATE_MODAL_ID)
    .setTitle("Nouveau filtre anti-spam");

  const name = new TextInputBuilder()
    .setCustomId("name")
    .setLabel("Nom du filtre")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Ex: Filtre general");
  const mode = new TextInputBuilder()
    .setCustomId("mode")
    .setLabel("Mode (whitelist ou blacklist)")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("blacklist");
  const messageLimit = new TextInputBuilder()
    .setCustomId("message_limit")
    .setLabel("Nombre max de messages")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Ex: 3");
  const interval = new TextInputBuilder()
    .setCustomId("interval_sec")
    .setLabel("Fenetre de temps (secondes)")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Ex: 3");
  const timeout = new TextInputBuilder()
    .setCustomId("timeout_sec")
    .setLabel("Duree du timeout (secondes)")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Ex: 300");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(name),
    new ActionRowBuilder<TextInputBuilder>().addComponents(mode),
    new ActionRowBuilder<TextInputBuilder>().addComponents(messageLimit),
    new ActionRowBuilder<TextInputBuilder>().addComponents(interval),
    new ActionRowBuilder<TextInputBuilder>().addComponents(timeout),
  );

  await interaction.showModal(modal);
  const submitted = await interaction
    .awaitModalSubmit({
      time: 120000,
      filter: (i) =>
        i.customId === SETTINGS_AS_CREATE_MODAL_ID && i.user.id === interaction.user.id,
    })
    .catch(() => undefined);
  if (!submitted) return;

  const rawMode = submitted.fields.getTextInputValue("mode").trim().toLowerCase();
  const messageLimitRaw = submitted.fields.getTextInputValue("message_limit").trim();
  const intervalRaw = submitted.fields.getTextInputValue("interval_sec").trim();
  const timeoutRaw = submitted.fields.getTextInputValue("timeout_sec").trim();
  if (
    (rawMode !== "whitelist" && rawMode !== "blacklist") ||
    !isPositiveInt(messageLimitRaw) ||
    !isPositiveInt(intervalRaw) ||
    !isPositiveInt(timeoutRaw)
  ) {
    await submitted.reply({
      content:
        "Valeurs invalides. Mode: whitelist/blacklist. Les 3 champs de seuil attendent des entiers positifs (secondes pour les durees).",
      flags: MessageFlags.Ephemeral,
    });
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
  await submitted.reply({
    content: "Filtre cree. Tu peux maintenant lui associer des salons.",
    flags: MessageFlags.Ephemeral,
  });

  await interaction.editReply(await renderRuleEditor(guildID, created.id));
}

async function openMetaModal(interaction: StringSelectMenuInteraction, guildID: string, ruleID: string) {
  const rule = await spamFilterRuleService.getRuleByID(guildID, ruleID);
  if (!rule) return;

  const modal = new ModalBuilder()
    .setCustomId(`${SETTINGS_AS_META_MODAL_PREFIX}${ruleID}`)
    .setTitle("Modifier le filtre");

  const name = new TextInputBuilder()
    .setCustomId("name")
    .setLabel("Nom du filtre")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setValue(rule.name);
  const description = new TextInputBuilder()
    .setCustomId("description")
    .setLabel("Description")
    .setRequired(false)
    .setStyle(TextInputStyle.Short)
    .setValue(rule.description || "");
  const mode = new TextInputBuilder()
    .setCustomId("mode")
    .setLabel("Mode (whitelist ou blacklist)")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setValue(rule.mode);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(name),
    new ActionRowBuilder<TextInputBuilder>().addComponents(description),
    new ActionRowBuilder<TextInputBuilder>().addComponents(mode),
  );

  await interaction.showModal(modal);
  const submitted = await interaction
    .awaitModalSubmit({
      time: 120000,
      filter: (i) =>
        i.customId === `${SETTINGS_AS_META_MODAL_PREFIX}${ruleID}` &&
        i.user.id === interaction.user.id,
    })
    .catch(() => undefined);
  if (!submitted) return;

  const rawMode = submitted.fields.getTextInputValue("mode").trim().toLowerCase();
  if (rawMode !== "whitelist" && rawMode !== "blacklist") {
    await submitted.reply({
      content: "Mode invalide. Valeurs autorisees: whitelist ou blacklist.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await spamFilterRuleService.updateRule(guildID, ruleID, {
    name: submitted.fields.getTextInputValue("name").trim(),
    description: submitted.fields.getTextInputValue("description").trim(),
    mode: rawMode,
  });
  invalidateSpamCheckers(guildID);
  await submitted.reply({
    content: "Filtre mis a jour.",
    flags: MessageFlags.Ephemeral,
  });
  await interaction.editReply(await renderRuleEditor(guildID, ruleID));
}

async function openThresholdModal(
  interaction: StringSelectMenuInteraction,
  guildID: string,
  ruleID: string,
) {
  const rule = await spamFilterRuleService.getRuleByID(guildID, ruleID);
  if (!rule) return;

  const modal = new ModalBuilder()
    .setCustomId(`${SETTINGS_AS_THRESHOLDS_MODAL_PREFIX}${ruleID}`)
    .setTitle("Modifier les seuils anti-spam");
  const messageLimit = new TextInputBuilder()
    .setCustomId("message_limit")
    .setLabel("Nombre max de messages")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setValue(String(rule.messageLimit));
  const interval = new TextInputBuilder()
    .setCustomId("interval_sec")
    .setLabel("Fenetre de temps (secondes)")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setValue(String(rule.intervalInSec));
  const timeout = new TextInputBuilder()
    .setCustomId("timeout_sec")
    .setLabel("Duree du timeout (secondes)")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setValue(String(rule.punishmentDurationInSec));
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(messageLimit),
    new ActionRowBuilder<TextInputBuilder>().addComponents(interval),
    new ActionRowBuilder<TextInputBuilder>().addComponents(timeout),
  );

  await interaction.showModal(modal);
  const submitted = await interaction
    .awaitModalSubmit({
      time: 120000,
      filter: (i) =>
        i.customId === `${SETTINGS_AS_THRESHOLDS_MODAL_PREFIX}${ruleID}` &&
        i.user.id === interaction.user.id,
    })
    .catch(() => undefined);
  if (!submitted) return;

  const messageLimitRaw = submitted.fields.getTextInputValue("message_limit").trim();
  const intervalRaw = submitted.fields.getTextInputValue("interval_sec").trim();
  const timeoutRaw = submitted.fields.getTextInputValue("timeout_sec").trim();
  if (
    !isPositiveInt(messageLimitRaw) ||
    !isPositiveInt(intervalRaw) ||
    !isPositiveInt(timeoutRaw)
  ) {
    await submitted.reply({
      content:
        "Valeurs invalides. Les 3 champs attendent des entiers positifs (secondes pour les durees).",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await spamFilterRuleService.updateRule(guildID, ruleID, {
    messageLimit: Number(messageLimitRaw),
    intervalInSec: Number(intervalRaw),
    punishmentDurationInSec: Number(timeoutRaw),
  });
  invalidateSpamCheckers(guildID);
  await submitted.reply({
    content: "Seuil mis a jour.",
    flags: MessageFlags.Ephemeral,
  });
  await interaction.editReply(await renderRuleEditor(guildID, ruleID));
}

export async function onRuleAction(
  interaction: StringSelectMenuInteraction,
  guildID: string,
  ruleID: string,
) {
  const action = interaction.values[0];

  if (action === "meta") {
    await openMetaModal(interaction, guildID, ruleID);
    return;
  }
  if (action === "thresholds") {
    await openThresholdModal(interaction, guildID, ruleID);
    return;
  }
  if (action === "toggle") {
    const rule = await spamFilterRuleService.getRuleByID(guildID, ruleID);
    if (!rule) return;
    await spamFilterRuleService.updateRule(guildID, ruleID, {
      enabled: !rule.enabled,
    });
    invalidateSpamCheckers(guildID);
    await interaction.update(await renderRuleEditor(guildID, ruleID));
    return;
  }
  if (action === "delete") {
    await spamFilterRuleService.deleteRule(guildID, ruleID);
    invalidateSpamCheckers(guildID);
    await interaction.update(await renderAntiSpamHome(guildID));
    return;
  }

  await interaction.update(await renderAntiSpamHome(guildID));
}

export async function onRuleChannels(
  interaction: ChannelSelectMenuInteraction,
  guildID: string,
  ruleID: string,
) {
  await spamFilterRuleService.updateRule(guildID, ruleID, {
    channelIDs: interaction.values,
  });
  invalidateSpamCheckers(guildID);
  await interaction.update(await renderRuleEditor(guildID, ruleID));
}

export async function onMainMenuSelection(
  interaction: StringSelectMenuInteraction,
  guildID: string,
  onOpenHome: () => Promise<void>,
  onOpenStatsHome: () => Promise<void>,
) {
  const value = interaction.values[0];

  if (value === "anti_spam") {
    await interaction.update(await renderAntiSpamHome(guildID));
    return;
  }
  if (value === "stats") {
    await onOpenStatsHome();
    return;
  }
  if (value === "nav:home") {
    await onOpenHome();
    return;
  }
  if (value === "as:create") {
    await openCreateRuleModal(interaction, guildID);
    return;
  }
  if (value.startsWith("as:edit:")) {
    const ruleID = value.slice("as:edit:".length);
    await interaction.update(await renderRuleEditor(guildID, ruleID));
  }
}
