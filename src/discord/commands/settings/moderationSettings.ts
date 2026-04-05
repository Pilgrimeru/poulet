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
  RoleSelectMenuBuilder,
  RoleSelectMenuInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";

export async function renderModerationSettings(guildID: string, ids: ScopedSettingsIds) {
  const settings = await guildSettingsService.getByGuildID(guildID);

  const embed = new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle("Settings - Modération")
    .setDescription(
      [
        `Salon de notifications : ${settings.moderationNotifChannelID ? `<#${settings.moderationNotifChannelID}>` : "non défini"}`,
        `Rôle modérateur : ${settings.moderationModRoleID ? `<@&${settings.moderationModRoleID}>` : "non défini"}`,
        "",
        "Les notifications de contestation de résultat et d'appel seront envoyées dans ce salon, avec une mention du rôle modérateur.",
        "Le lien fourni dans la notification renvoie directement vers le bon onglet du dashboard.",
      ].join("\n"),
    );

  const actionsMenu = new StringSelectMenuBuilder()
    .setCustomId(ids.MOD_ACTIONS)
    .setPlaceholder("Actions")
    .addOptions([{ label: "Retour accueil", description: "Revenir au menu principal", value: "nav:home" }]);

  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId(ids.MOD_CHANNEL_SELECT)
    .setPlaceholder("Salon de notifications de modération")
    .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
    .setMinValues(0)
    .setMaxValues(1);

  if (settings.moderationNotifChannelID) {
    channelMenu.setDefaultChannels(settings.moderationNotifChannelID);
  }

  const roleMenu = new RoleSelectMenuBuilder()
    .setCustomId(ids.MOD_ROLE_SELECT)
    .setPlaceholder("Rôle modérateur à mentionner")
    .setMinValues(0)
    .setMaxValues(1);

  if (settings.moderationModRoleID) {
    roleMenu.setDefaultRoles(settings.moderationModRoleID);
  }

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(actionsMenu),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelMenu),
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleMenu),
    ],
  };
}

export async function onModerationAction(
  interaction: StringSelectMenuInteraction,
  ids: ScopedSettingsIds,
) {
  if (interaction.values[0] === "nav:home") {
    await interaction.update(await renderHome(ids));
  }
}

export async function onModerationChannelSelect(
  interaction: ChannelSelectMenuInteraction,
  guildID: string,
  ids: ScopedSettingsIds,
) {
  await guildSettingsService.updateByGuildID(guildID, { moderationNotifChannelID: interaction.values[0] ?? "" });
  await interaction.update(await renderModerationSettings(guildID, ids));
}

export async function onModerationRoleSelect(
  interaction: RoleSelectMenuInteraction,
  guildID: string,
  ids: ScopedSettingsIds,
) {
  await guildSettingsService.updateByGuildID(guildID, { moderationModRoleID: interaction.values[0] ?? "" });
  await interaction.update(await renderModerationSettings(guildID, ids));
}
