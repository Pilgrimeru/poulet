import { config } from "@/app";
import { guildSettingsService } from "@/api";
import {
  SETTINGS_SB_CONFIG_MODAL_ID,
  ScopedSettingsIds,
} from "@/discord/commands/settings/ids";
import { renderHome } from "@/discord/commands/settings/home";
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

export async function renderStarboard(guildID: string, ids: ScopedSettingsIds) {
  const settings = await guildSettingsService.getByGuildID(guildID);
  const active = !!(settings.starboardChannelID && settings.starboardEmoji);

  const embed = new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle("Settings - Starboard")
    .setDescription(
      [
        `Salon : ${settings.starboardChannelID ? `<#${settings.starboardChannelID}>` : "non défini"}`,
        `Emoji : ${settings.starboardEmoji || "non défini"}`,
        `Seuil : ${settings.starboardThreshold} réaction(s)`,
        `Statut : ${active ? "actif" : "inactif"}`,
        "",
        "Quand un message atteint le seuil de réactions avec l'emoji configuré, il est transféré dans le salon starboard.",
      ].join("\n"),
    );

  const actionsMenu = new StringSelectMenuBuilder()
    .setCustomId(ids.SB_ACTIONS)
    .setPlaceholder("Actions")
    .addOptions([
      { label: "Configurer emoji et seuil", description: "Définir l'emoji et le nombre de réactions requis", value: "config" },
      { label: "Retour accueil", description: "Revenir au menu principal", value: "nav:home" },
    ]);

  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId(ids.SB_CHANNEL_SELECT)
    .setPlaceholder("Choisir le salon starboard")
    .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
    .setMinValues(0)
    .setMaxValues(1);

  if (settings.starboardChannelID) {
    channelMenu.setDefaultChannels(settings.starboardChannelID);
  }

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(actionsMenu),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelMenu),
    ],
  };
}

export async function onStarboardAction(
  interaction: StringSelectMenuInteraction,
  guildID: string,
  ids: ScopedSettingsIds,
) {
  const action = interaction.values[0];

  if (action === "nav:home") {
    await interaction.update(await renderHome(ids));
    return;
  }

  if (action === "config") {
    const settings = await guildSettingsService.getByGuildID(guildID);
    const modal = new ModalBuilder()
      .setCustomId(SETTINGS_SB_CONFIG_MODAL_ID)
      .setTitle("Configurer le Starboard");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("emoji")
          .setLabel("Emoji (ex: ⭐ ou <:nom:123456>)")
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
          .setValue(settings.starboardEmoji),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("threshold")
          .setLabel("Nombre de réactions requis")
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
          .setValue(String(settings.starboardThreshold)),
      ),
    );

    await interaction.showModal(modal);
    const submitted = await interaction
      .awaitModalSubmit({
        time: 120_000,
        filter: (i) => i.customId === SETTINGS_SB_CONFIG_MODAL_ID && i.user.id === interaction.user.id,
      })
      .catch(() => undefined);
    if (!submitted) return;

    const emoji = submitted.fields.getTextInputValue("emoji").trim();
    const thresholdRaw = submitted.fields.getTextInputValue("threshold").trim();
    const threshold = parseInt(thresholdRaw, 10);

    if (!emoji || isNaN(threshold) || threshold < 1) {
      await submitted.reply({ content: "Valeurs invalides. L'emoji ne peut pas être vide et le seuil doit être un entier positif.", flags: MessageFlags.Ephemeral });
      return;
    }

    await guildSettingsService.updateByGuildID(guildID, { starboardEmoji: emoji, starboardThreshold: threshold });
    await submitted.reply({ content: "Configuration du starboard mise à jour.", flags: MessageFlags.Ephemeral });
    await interaction.editReply(await renderStarboard(guildID, ids));
  }
}

export async function onStarboardChannelSelect(
  interaction: ChannelSelectMenuInteraction,
  guildID: string,
  ids: ScopedSettingsIds,
) {
  await guildSettingsService.updateByGuildID(guildID, { starboardChannelID: interaction.values[0] ?? "" });
  await interaction.update(await renderStarboard(guildID, ids));
}
