import { messageSnapshotService } from "@/database/services";
import { Event } from "@/discord/types";
import { Message, PartialMessage } from "discord.js";

export default new Event("messageUpdate", async (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
  if (newMessage.author?.bot || !newMessage.guild) return;
  if (newMessage.content === oldMessage.content) return;

  const msg = newMessage.partial ? await newMessage.fetch().catch(() => null) : newMessage;
  if (!msg) return;

  const version = await messageSnapshotService.getNextVersion(msg.id);

  await messageSnapshotService.saveSnapshot(
    {
      messageID: msg.id,
      channelID: msg.channelId,
      guildID: msg.guildId!,
      authorID: msg.author.id,
      authorUsername: msg.author.username,
      authorDisplayName: msg.member?.displayName ?? msg.author.displayName,
      authorAvatarURL: msg.author.displayAvatarURL(),
      content: msg.content ?? "",
      createdAt: msg.createdTimestamp,
    },
    msg.attachments.map((a) => ({
      attachmentID: a.id,
      filename: a.name,
      url: a.url,
      contentType: a.contentType ?? "",
      size: a.size,
    })),
    version,
  );
});
