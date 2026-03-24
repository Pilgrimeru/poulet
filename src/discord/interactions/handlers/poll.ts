import { pollManager } from "@/discord/components";
import { componentRouter } from "@/discord/interactions/ComponentRouter";

export function registerPollHandlers(): void {
  componentRouter.registerPrefix("v:", async (interaction) => {
    if (!interaction.isButton()) return;
    const [, pollId, optionSelected] = interaction.customId.split(":");
    const optionIndex = Number.parseInt(optionSelected, 10);
    const poll = await pollManager.getPoll(pollId);
    if (!poll) { await interaction.deferUpdate(); return; }

    if (!pollManager.expirationQueue.has(pollId)) {
      await pollManager.activateExpiration(poll, interaction.message);
    }
    await pollManager.userVoteInteraction(poll, interaction.user.id, optionIndex);
    const embed = await pollManager.updateEmbed(poll);
    if (embed) await interaction.message.edit({ embeds: [embed] });
    await interaction.deferUpdate();
  });
}
