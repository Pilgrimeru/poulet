import { i18n } from "@/app";
import { bot } from "@/app/runtime";
import { componentRouter } from "@/discord/interactions";
import { Event } from "@/discord/types";
import { autoDelete } from "@/discord/utils";
import { ChatInputCommandInteraction, MessageContextMenuCommandInteraction, MessageFlags, PermissionsBitField, UserContextMenuCommandInteraction } from "discord.js";

export default new Event("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    await processChatInput(interaction);
  } else if (interaction.isUserContextMenuCommand() || interaction.isMessageContextMenuCommand()) {
    await processContextMenu(interaction);
  } else if (interaction.isMessageComponent()) {
    console.info("[interactionCreate] component", {
      kind: interaction.componentType,
      customId: interaction.customId,
      userId: interaction.user.id,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
    });
    const handled = await componentRouter.dispatch(interaction);
    if (!handled && !interaction.replied && !interaction.deferred) {
      console.warn("[interactionCreate] unhandled component interaction", { customId: interaction.customId });
      await interaction.reply({
        content: "Cette interaction n'est plus disponible ou n'est pas reconnue.",
        flags: MessageFlags.Ephemeral,
      }).catch((error) => console.error("[interactionCreate] failed to reply to unhandled component", error));
    }
  } else if (interaction.isModalSubmit()) {
    console.info("[interactionCreate] modal", {
      customId: interaction.customId,
      userId: interaction.user.id,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
    });
    const handled = await componentRouter.dispatch(interaction);
    if (!handled && !interaction.replied && !interaction.deferred) {
      console.warn("[interactionCreate] unhandled modal interaction", { customId: interaction.customId });
      await interaction.reply({
        content: "Cette interaction n'est plus disponible ou n'est pas reconnue.",
        flags: MessageFlags.Ephemeral,
      }).catch((error) => console.error("[interactionCreate] failed to reply to unhandled modal", error));
    }
  }
});

async function processContextMenu(interaction: UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction): Promise<void> {
  const command = bot.contextMenuCommands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await replyWithCommandError(interaction);
  }
}

async function processChatInput(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildBot = interaction.guild!.members.cache.get(bot.user!.id)!;
  const interactionChannel = interaction.guild!.channels.resolve(interaction.channelId);
  if (!interactionChannel) return;

  const perms = interactionChannel.permissionsFor(guildBot);
  if (
    !perms.has(PermissionsBitField.Flags.ViewChannel) ||
    !perms.has(PermissionsBitField.Flags.SendMessages)
  ) return;

  const command = bot.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await replyWithCommandError(interaction);
  }
}

async function replyWithCommandError(
  interaction: ChatInputCommandInteraction | UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction,
): Promise<void> {
  const content = i18n.__("errors.command");

  try {
    if (interaction.deferred) {
      await interaction.editReply({ content });
      return;
    }
    if (interaction.replied) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({ content, flags: MessageFlags.Ephemeral }).then(autoDelete);
  } catch (replyError) {
    console.error("[interactionCreate] Failed to send command error response", replyError);
  }
}
