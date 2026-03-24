import {
  guildSettingsService,
  messageHistoryService,
  spamFilterRuleService,
} from "@/database/services";
import { resolveSpamCheckers } from "@/discord/components";
import { Event } from "@/discord/types";
import { Message } from "discord.js";

const regexInviteLink =
  /\b(https?:\/\/)?(discord\.gg|discordapp\.com\/invite)\/\w+\b/gm;

export default new Event("messageCreate", async (message: Message) => {
  if (message.author.bot || !message.guild) return;
  const guildID = message.guild.id;

  const guildSettings = await guildSettingsService.getByGuildID(guildID);
  const spamRules = await spamFilterRuleService.getRulesByGuildID(guildID);
  const spamCheckers = resolveSpamCheckers(
    guildID,
    spamRules,
  );

  for (const filter of spamCheckers) {
    if (!filter.checker.check(message)) return;
  }
  if (!inviteVerification(message)) return;

  if (message.content.match(regexInviteLink)) {
    await message.delete();
    return;
  }

  if (message.interactionMetadata === null) {
    await messageHistoryService.createMessageHistory({
      userID: message.author.id,
      date: Date.now(),
      guildID: message.guildId!,
      channelID: message.channelId,
    });
  }

  if (message.channelId === guildSettings.emoteChannelID) emoteChannel(message);
});

function emoteChannel(message: Message): void {
  if (
    new RegExp(/(http|https):\/\/[^\s]+/).exec(message.content) ||
    message.attachments.size > 0
  ) {
    void message.react("😂");
  }
}

function inviteVerification(message: Message): boolean {
  if (message.content.match(regexInviteLink)) {
    void message.delete();
    return false;
  }
  return true;
}
