import { i18n } from "@/app";
import { bot } from "@/app/runtime";
import { componentRouter } from "@/discord/interactions";
import { Event } from "@/discord/types";
import { autoDelete } from "@/discord/utils";
import { ChatInputCommandInteraction, MessageContextMenuCommandInteraction, PermissionsBitField, UserContextMenuCommandInteraction } from "discord.js";

export default new Event("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    await processChatInput(interaction);
  } else if (interaction.isUserContextMenuCommand() || interaction.isMessageContextMenuCommand()) {
    await processContextMenu(interaction);
  } else if (interaction.isMessageComponent()) {
    await componentRouter.dispatch(interaction);
  }
});

async function processContextMenu(interaction: UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction): Promise<void> {
  const command = bot.contextMenuCommands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    interaction.reply(i18n.__("errors.command")).then(autoDelete);
    console.error(error);
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
    interaction.reply(i18n.__("errors.command")).then(autoDelete);
    console.error(error);
  }
}
