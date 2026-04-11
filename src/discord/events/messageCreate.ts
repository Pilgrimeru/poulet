import {
  channelRuleService,
  guildSettingsService,
  messageHistoryService,
  messageSnapshotService,
  spamFilterRuleService,
} from "@/api";
import { ChannelRuleDTO } from "@/api/channelRuleService";
import { autoResponseService, AutoResponseDTO, TriggerGroup } from "@/api/autoResponseService";
import { resolveSpamCheckers } from "@/discord/components";
import { MODERATION_MESSAGES } from "@/discord/components/moderation/moderationMessages";
import { Event } from "@/discord/types";
import { ChannelType, Message } from "discord.js";

export default new Event("messageCreate", async (message: Message) => {
  if (message.author.bot || !message.guild) return;
  const guildID = message.guild.id;

  const guildSettings = await guildSettingsService.getByGuildID(guildID);
  const spamRules = await spamFilterRuleService.getRulesByGuildID(guildID);
  const spamCheckers = resolveSpamCheckers(guildID, spamRules);

  for (const filter of spamCheckers) {
    if (!filter.checker.check(message)) return;
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

    const referencedMessage = message.reference?.messageId
      ? await message.fetchReference().catch(() => null)
      : null;

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
        referencedMessageID: referencedMessage?.id ?? null,
        referencedMessageContent: referencedMessage?.content ?? null,
        referencedMessageAuthor: referencedMessage?.member?.displayName ?? referencedMessage?.author.displayName ?? null,
      },
      message.attachments.map((a) => ({
        attachmentID: a.id,
        filename: a.name,
        url: a.url,
        contentType: a.contentType ?? "",
        size: a.size,
      })),
    );
  }

  if (message.channelId === guildSettings.emoteChannelID) emoteChannel(message);

  if (channelRule) {
    void applyAutoThread(message, channelRule);
  }

  const autoResponses = await autoResponseService.getByGuildID(guildID);
  for (const rule of autoResponses) {
    applyAutoResponse(message, rule).catch(() => undefined);
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
    content: MODERATION_MESSAGES.singleMessageLimitNotice(message.author),
  }).catch(() => null);
  if (notice) setTimeout(() => notice.delete().catch(() => undefined), 5000);

  return true;
}

/**
 * Checks whether a message matches a trigger group.
 * All active conditions in the group must match (AND logic).
 */
function matchesTriggerGroup(message: Message, group: TriggerGroup): boolean {
  const content = message.content.toLowerCase();

  // Keywords
  if (group.keywords.length > 0) {
    const lowerKeywords = group.keywords.map((k) => k.toLowerCase());
    const keywordsMatch =
      group.keywordMode === "all"
        ? lowerKeywords.every((k) => content.includes(k))
        : lowerKeywords.some((k) => content.includes(k));
    if (!keywordsMatch) return false;
  }

  // Regex
  if (group.regex) {
    try {
      if (!new RegExp(group.regex, "i").test(message.content)) return false;
    } catch {
      // invalid regex — skip condition
    }
  }

  // Attachment
  if (group.hasAttachment !== null) {
    const has = message.attachments.size > 0;
    if (has !== group.hasAttachment) return false;
  }

  return true;
}

async function applyAutoResponse(message: Message, rule: AutoResponseDTO): Promise<void> {
  if (!rule.enabled) return;

  // Channel scoping
  if (rule.channelMode === "whitelist" && !rule.channelIDs.includes(message.channelId)) return;
  if (rule.channelMode === "blacklist" && rule.channelIDs.includes(message.channelId)) return;

  // Trigger groups: OR between groups (at least one group must fully match)
  const triggered =
    rule.triggerGroups.length === 0 ||
    rule.triggerGroups.some((group) => matchesTriggerGroup(message, group));
  if (!triggered) return;

  // React with emojis
  for (const emoji of rule.responseEmojis) {
    const customMatch = /^<a?:(\w+):(\d+)>$/.exec(emoji);
    const emojiResolvable = customMatch ? `${customMatch[1]}:${customMatch[2]}` : emoji;
    await message.react(emojiResolvable).catch(() => undefined);
  }

  // Send a message
  if (rule.responseMessage) {
    if (rule.responseReply) {
      await message.reply({ content: rule.responseMessage }).catch(() => undefined);
    } else if (message.channel.isSendable()) {
      await message.channel.send({ content: rule.responseMessage }).catch(() => undefined);
    }
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

