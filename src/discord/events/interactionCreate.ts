import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  PermissionsBitField,
} from "discord.js";
import { pollManager } from "@/discord/components";
import { i18n } from "@/app";
import { bot } from "@/app/runtime";
import { Event } from "@/discord/types";
import { autoDelete } from "@/discord/utils";

export default new Event("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    processChatInput(interaction);
  } else if (interaction.isButton()) {
    await processButtons(interaction);
  }
});

async function processButtons(interaction: ButtonInteraction) {
  if (interaction.customId.startsWith("v:")) {
    const userId = interaction.user.id;
    const [_, pollId, optionSelected] = interaction.customId.split(":");
    const optionIndex = parseInt(optionSelected, 10);
    const poll = await pollManager.getPoll(pollId);
    if (!poll) return interaction.deferUpdate();

    if (!pollManager.expirationQueue.has(pollId)) {
      await pollManager.activateExpiration(poll, interaction.message);
    }
    await pollManager.userVoteInteraction(poll, userId, optionIndex);
    const embed = await pollManager.updateEmbed(poll);
    if (embed) {
      await interaction.message.edit({ embeds: [embed] });
    }
    await interaction.deferUpdate();
  }
}

function processChatInput(interaction: ChatInputCommandInteraction) {
  const guildBot = interaction.guild!.members.cache.get(bot.user!.id)!;
  const interactionChannel = interaction.guild!.channels.resolve(
    interaction.channelId,
  );
  if (!interactionChannel) return;
  const canView = interactionChannel
    .permissionsFor(guildBot)
    .has(PermissionsBitField.Flags.ViewChannel);
  const canSendMsg = interactionChannel
    .permissionsFor(guildBot)
    .has(PermissionsBitField.Flags.SendMessages);
  if (!canView || !canSendMsg) return;

  const command = bot.commands.get(interaction.commandName);
  if (!command) return;

  try {
    command.execute(interaction);
  } catch (error) {
    interaction.reply(i18n.__("errors.command")).then(autoDelete);
    console.error(error);
  }
}
