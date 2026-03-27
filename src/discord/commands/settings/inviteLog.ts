import { config } from "@/app";
import { guildSettingsService } from "@/api";
import { renderHome } from "@/discord/commands/settings/home";
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

export async function renderInviteLog(guildID: string, ids: ScopedSettingsIds) {
  const settings = await guildSettingsService.getByGuildID(guildID);

  const embed = new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle("Settings - Invite Log")
    .setDescription(
      `Salon de log : ${settings.inviteLogChannelID ? `<#${settings.inviteLogChannelID}>` : "non défini"}\n` +
        "Quand un membre rejoint ou quitte, un message sera envoyé dans ce salon avec le nom de la personne qui a invité.",
    );

  const actionsMenu = new StringSelectMenuBuilder()
    .setCustomId(ids.IL_ACTIONS)
    .setPlaceholder("Actions")
    .addOptions([{ label: "Retour accueil", description: "Revenir au menu principal", value: "nav:home" }]);

  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId(ids.IL_CHANNEL_SELECT)
    .setPlaceholder("Choisir le salon de log des invitations")
    .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
    .setMinValues(0)
    .setMaxValues(1);

  if (settings.inviteLogChannelID) {
    channelMenu.setDefaultChannels(settings.inviteLogChannelID);
  }

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(actionsMenu),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelMenu),
    ],
  };
}

export async function onInviteLogAction(
  interaction: StringSelectMenuInteraction,
  ids: ScopedSettingsIds,
) {
  if (interaction.values[0] === "nav:home") {
    await interaction.update(await renderHome(ids));
  }
}

export async function onInviteLogChannelSelect(
  interaction: ChannelSelectMenuInteraction,
  guildID: string,
  ids: ScopedSettingsIds,
) {
  await guildSettingsService.updateByGuildID(guildID, { inviteLogChannelID: interaction.values[0] ?? "" });
  await interaction.update(await renderInviteLog(guildID, ids));
}
