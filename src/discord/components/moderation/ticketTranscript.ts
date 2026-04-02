import type { ContextMessage } from "@/api";
import { messageSnapshotService } from "@/api";
import { formatTranscriptLine } from "./messageFormatting";
import type { Guild, Message, TextChannel } from "discord.js";

const DISCORD_MESSAGE_LINK_RE = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/g;
const CHANNEL_MENTION_RE = /<#(\d+)>/g;
const USER_MENTION_RE = /<@!?(\d+)>/g;

export async function resolveReferencedContext(
  message: Message,
  knownMessages?: Map<string, Message>,
): Promise<Pick<ContextMessage, "referencedMessageID" | "referencedAuthorID" | "referencedAuthorUsername" | "referencedContent">> {
  const referencedMessageID = message.reference?.messageId ?? null;
  if (!referencedMessageID) {
    return {
      referencedMessageID: null,
      referencedAuthorID: null,
      referencedAuthorUsername: null,
      referencedContent: null,
    };
  }

  const referencedMessage =
    knownMessages?.get(referencedMessageID) ??
    await message.fetchReference().catch(() => null);

  return {
    referencedMessageID,
    referencedAuthorID: referencedMessage?.author.id ?? null,
    referencedAuthorUsername: referencedMessage?.member?.displayName ?? referencedMessage?.author.username ?? null,
    referencedContent: referencedMessage?.content ?? null,
  };
}

export async function collectContextMessages(targetMessage: Message): Promise<ContextMessage[]> {
  const fetched = await targetMessage.channel.messages.fetch({ limit: 60, around: targetMessage.id }).catch(() => null);
  if (!fetched) {
    const referenced = await resolveReferencedContext(targetMessage);
    return [
      {
        id: targetMessage.id,
        authorID: targetMessage.author.id,
        authorUsername: targetMessage.author.username,
        authorAvatarURL: targetMessage.author.displayAvatarURL(),
        content: targetMessage.content,
        createdAt: targetMessage.createdTimestamp,
        ...referenced,
        attachments: [...targetMessage.attachments.values()]
          .filter((a) => a.contentType?.startsWith("image/") ?? false)
          .map((a) => ({ url: a.url, contentType: a.contentType ?? "image/unknown", filename: a.name })),
      },
    ];
  }

  const orderedMessages = [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const knownMessages = new Map(orderedMessages.map((message) => [message.id, message]));

  return Promise.all(orderedMessages.map(async (message) => ({
    id: message.id,
    authorID: message.author.id,
    authorUsername: message.member?.displayName ?? message.author.username,
    authorAvatarURL: message.author.displayAvatarURL(),
    content: message.content,
    createdAt: message.createdTimestamp,
    ...(await resolveReferencedContext(message, knownMessages)),
    attachments: [...message.attachments.values()]
      .filter((a) => a.contentType?.startsWith("image/") ?? false)
      .map((a) => ({ url: a.url, contentType: a.contentType ?? "image/unknown", filename: a.name })),
  })));
}

export async function collectTicketMessages(channel: TextChannel): Promise<ContextMessage[]> {
  const messages = await channel.messages.fetch({ limit: 100 });
  const orderedMessages = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const knownMessages = new Map(orderedMessages.map((message) => [message.id, message]));
  return Promise.all(orderedMessages.map(async (message) => ({
    id: message.id,
    authorID: message.author.id,
    authorUsername: message.author.bot ? `[bot] ${message.author.username}` : message.author.username,
    authorAvatarURL: message.author.displayAvatarURL(),
    content: message.content,
    createdAt: message.createdTimestamp,
    ...(await resolveReferencedContext(message, knownMessages)),
  })));
}

export async function enrichContent(guild: Guild, content: string): Promise<string> {
  let result = content;

  const channelMatches = [...result.matchAll(CHANNEL_MENTION_RE)];
  for (const match of channelMatches) {
    const channelId = match[1];
    const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
    if (channel) {
      result = result.replace(match[0], `${match[0]} (#${channel.name})`);
    }
  }

  const userMatches = [...result.matchAll(USER_MENTION_RE)];
  for (const match of userMatches) {
    const userId = match[1];
    const member = guild.members.cache.get(userId) ?? await guild.members.fetch(userId).catch(() => null);
    const display = member
      ? `${member.user.username}${member.nickname ? ` / ${member.nickname}` : ""}`
      : null;
    if (display) {
      result = result.replace(match[0], `${match[0]} (${display})`);
    }
  }

  const linkMatches = [...result.matchAll(DISCORD_MESSAGE_LINK_RE)];
  for (const match of linkMatches) {
    const [fullUrl, linkGuildId, , messageId] = match;
    if (linkGuildId !== guild.id) continue;

    const versions = await messageSnapshotService.getMessageHistory(messageId).catch(() => null);
    if (!versions || versions.length === 0) continue;

    const latest = versions.at(-1)!;
    const date = new Date(latest.createdAt).toISOString();
    const editedFlag = versions.length > 1 ? " [EDITE]" : "";
    let block = `[lien-message: @${latest.authorUsername} le ${date}${editedFlag}: "${latest.content}"`;

    if (versions.length > 1) {
      const prevVersions = versions
        .slice(0, -1)
        .map((v) => `  > v${v.version + 1}: "${v.content}"`)
        .join("\n");
      block += `\n${prevVersions}`;
    }

    block += "]";
    result = result.replace(fullUrl, block);
  }

  return result;
}

export async function ticketMessagesToTranscript(guild: Guild, messages: ContextMessage[]): Promise<string> {
  const lines = await Promise.all(
    messages
      .filter((msg) => msg.content.trim() !== "")
      .map(async (msg) => {
        const enriched = await enrichContent(guild, msg.content);
        const referenced = msg.referencedMessageID
          ? await enrichContent(guild, msg.referencedContent ?? "")
          : null;
        return formatTranscriptLine({
          createdAt: msg.createdAt,
          authorUsername: msg.authorUsername,
          content: enriched,
          referencedMessageID: msg.referencedMessageID,
          referencedAuthorID: msg.referencedAuthorID,
          referencedAuthorUsername: msg.referencedAuthorUsername,
          referencedContent: referenced,
        });
      }),
  );
  return lines.join("\n");
}
