import {
  channelRuleService,
  guildSettingsService,
  messageHistoryService,
  messageSnapshotService,
  spamFilterRuleService,
} from "@/database/services";
import { ChannelRuleDTO } from "@/database/services/channelRuleService";
import { resolveSpamCheckers } from "@/discord/components";
import { Event } from "@/discord/types";
import { ChannelType, Message } from "discord.js";

const regexInviteLink =
  /\b(https?:\/\/)?(discord\.gg|discordapp\.com\/invite)\/\w+\b/gm;
const regexLink = /(http|https):\/\/[^\s]+/;

export default new Event("messageCreate", async (message: Message) => {
  if (message.author.bot || !message.guild) return;
  const guildID = message.guild.id;

  const guildSettings = await guildSettingsService.getByGuildID(guildID);
  const spamRules = await spamFilterRuleService.getRulesByGuildID(guildID);
  const spamCheckers = resolveSpamCheckers(guildID, spamRules);

  for (const filter of spamCheckers) {
    if (!filter.checker.check(message)) return;
  }
  if (!inviteVerification(message)) return;

  if (message.content.match(regexInviteLink)) {
    await message.delete();
    return;
  }

  // Apply channel rules (one-message limit may delete the message and stop processing)
  const channelRule = await channelRuleService.getRuleByChannel(guildID, message.channelId);
  if (channelRule) {
    const deleted = await applyOneMessageLimit(message, guildID, channelRule);
    if (deleted) return;
  }

  if (message.interactionMetadata === null) {
    await messageHistoryService.createMessageHistory({
      userID: message.author.id,
      date: Date.now(),
      guildID: message.guildId!,
      channelID: message.channelId,
      messageID: message.id,
    });

    await messageSnapshotService.saveSnapshot(
      {
        messageID: message.id,
        channelID: message.channelId,
        guildID: message.guildId!,
        authorID: message.author.id,
        authorUsername: message.author.username,
        authorDisplayName: message.member?.displayName ?? message.author.displayName,
        authorAvatarURL: message.author.displayAvatarURL(),
        content: message.content,
        createdAt: message.createdTimestamp,
      },
      message.attachments.map((a) => ({
        attachmentID: a.id,
        filename: a.name,
        url: a.url,
        contentType: a.contentType ?? "",
        size: a.size,
      })),
      0,
    );
  }

  if (message.channelId === guildSettings.emoteChannelID) emoteChannel(message);

  if (channelRule) {
    void applyAutoReact(message, channelRule);
    void applyAutoThread(message, channelRule);
  }
});

async function applyOneMessageLimit(message: Message, guildID: string, rule: ChannelRuleDTO): Promise<boolean> {
  if (!rule.oneMessageLimit) return false;

  const previous = await messageHistoryService.getLatestByUserInChannel(guildID, message.author.id, message.channelId);
  if (!previous?.messageID) return false;

  // Check if the previous message still exists in the channel
  const channel = message.channel;
  if (!channel.isSendable()) return false;

  const exists = await channel.messages.fetch(previous.messageID).catch(() => null);
  if (!exists) return false;

  // Previous message still exists — delete the new one and notify the user
  await message.delete().catch(() => undefined);

  const notice = await channel.send({
    content: `${message.author} Tu ne peux envoyer qu'un seul message dans ce salon. Supprime ton message precedent pour en envoyer un nouveau.`,
  }).catch(() => null);
  if (notice) setTimeout(() => notice.delete().catch(() => undefined), 5000);

  return true;
}

async function applyAutoReact(message: Message, rule: ChannelRuleDTO): Promise<void> {
  if (rule.reactEmojis.length === 0) return;

  const hasImage = message.attachments.some((a) => a.contentType?.startsWith("image/"));
  const hasLink = regexLink.test(message.content);
  const filter = rule.reactFilter;

  const shouldReact =
    filter.includes("all") ||
    (filter.includes("images") && hasImage) ||
    (filter.includes("links") && hasLink);

  if (!shouldReact) return;

  for (const emoji of rule.reactEmojis) {
    // Custom emoji format: <:name:id> or <a:name:id> → extract name:id for react()
    const customMatch = /^<a?:(\w+):(\d+)>$/.exec(emoji);
    const emojiResolvable = customMatch ? `${customMatch[1]}:${customMatch[2]}` : emoji;
    await message.react(emojiResolvable).catch(() => undefined);
  }
}

async function applyAutoThread(message: Message, rule: ChannelRuleDTO): Promise<void> {
  if (!rule.autoThread) return;
  if (message.channel.type !== ChannelType.GuildText && message.channel.type !== ChannelType.GuildAnnouncement) return;

  await message.startThread({
    name: message.content.slice(0, 100) || "Discussion",
  }).catch(() => undefined);
}

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
