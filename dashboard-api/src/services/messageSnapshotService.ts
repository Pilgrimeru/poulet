import { col, fn } from "sequelize";
import { ChannelMeta } from "../db/models/ChannelMeta";
import { GuildMeta } from "../db/models/GuildMeta";
import { MessageAttachment } from "../db/models/MessageAttachment";
import { MessageSnapshot } from "../db/models/MessageSnapshot";

export interface AttachmentDTO {
  id: string;
  snapshotId: string;
  attachmentID: string;
  filename: string;
  url: string;
  contentType: string;
  size: number;
}

export interface MessageSnapshotDTO {
  id: string;
  messageID: string;
  channelID: string;
  guildID: string;
  authorID: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarURL: string;
  content: string;
  createdAt: number;
  snapshotAt: number;
  isDeleted: boolean;
  version: number;
  attachments: AttachmentDTO[];
}

async function toDTO(snapshot: MessageSnapshot): Promise<MessageSnapshotDTO> {
  const attachments = await MessageAttachment.findAll({ where: { snapshotId: snapshot.id } });
  return {
    id: snapshot.id,
    messageID: snapshot.messageID,
    channelID: snapshot.channelID,
    guildID: snapshot.guildID,
    authorID: snapshot.authorID,
    authorUsername: snapshot.authorUsername,
    authorDisplayName: snapshot.authorDisplayName,
    authorAvatarURL: snapshot.authorAvatarURL,
    content: snapshot.content,
    createdAt: Number(snapshot.createdAt),
    snapshotAt: Number(snapshot.snapshotAt),
    isDeleted: snapshot.isDeleted,
    version: snapshot.version,
    attachments: attachments.map((a) => ({
      id: a.id,
      snapshotId: a.snapshotId,
      attachmentID: a.attachmentID,
      filename: a.filename,
      url: a.url,
      contentType: a.contentType,
      size: a.size,
    })),
  };
}

export async function getDistinctGuilds(): Promise<{ guildID: string; name: string; iconURL: string }[]> {
  const rows = await MessageSnapshot.findAll({
    attributes: [[fn("DISTINCT", col("guildID")), "guildID"]],
    raw: true,
  }) as unknown as { guildID: string }[];

  return Promise.all(rows.map(async ({ guildID }) => {
    const meta = await GuildMeta.findByPk(guildID);
    return { guildID, name: meta?.name ?? "", iconURL: meta?.iconURL ?? "" };
  }));
}

export async function getDistinctChannels(guildID: string): Promise<{ channelID: string; channelName: string }[]> {
  const rows = await MessageSnapshot.findAll({
    attributes: [[fn("DISTINCT", col("channelID")), "channelID"]],
    where: { guildID },
    raw: true,
  }) as unknown as { channelID: string }[];

  return Promise.all(rows.map(async ({ channelID }) => {
    const meta = await ChannelMeta.findByPk(channelID);
    return { channelID, channelName: meta?.name ?? "" };
  }));
}

export interface MessageFilter {
  before?: number;
  after?: number;
  search?: string;
  authorID?: string;
  onlyDeleted?: boolean;
}

export async function getChannelMessages(
  guildID: string,
  channelID: string,
  limit = 50,
  filter: MessageFilter = {},
): Promise<MessageSnapshotDTO[]> {
  const { before, after, search, authorID, onlyDeleted } = filter;

  // Build WHERE conditions
  const conditions: string[] = ["guildID = :guildID", "channelID = :channelID"];
  const replacements: Record<string, unknown> = { guildID, channelID };

  if (before) { conditions.push("createdAt < :before"); replacements["before"] = before; }
  if (after)  { conditions.push("createdAt > :after");  replacements["after"]  = after; }
  if (authorID) { conditions.push("authorID = :authorID"); replacements["authorID"] = authorID; }
  if (onlyDeleted) { conditions.push("isDeleted = 1"); }
  if (search) {
    conditions.push("(content LIKE :search OR authorDisplayName LIKE :search OR authorUsername LIKE :search)");
    replacements["search"] = `%${search}%`;
  }

  const where = conditions.join(" AND ");

  // Fetch latest snapshot per messageID using a single efficient subquery
  // SQLite supports this pattern well with the composite index on (guildID, channelID, snapshotAt)
  const fetch = limit * 5; // overfetch to allow dedup, capped
  const rows = await MessageSnapshot.sequelize!.query<MessageSnapshot>(
    `SELECT * FROM MessageSnapshots
     WHERE ${where}
     ORDER BY snapshotAt DESC
     LIMIT :fetch`,
    { replacements: { ...replacements, fetch }, type: "SELECT", model: MessageSnapshot, mapToModel: true },
  );

  // Keep only the latest snapshot per messageID
  const seen = new Set<string>();
  const latestMap = new Map<string, MessageSnapshot>();
  for (const s of rows) {
    if (!seen.has(s.messageID)) {
      seen.add(s.messageID);
      latestMap.set(s.messageID, s);
      if (latestMap.size >= limit) break;
    }
  }

  // Re-sort by original send time (createdAt) so edits don't change message order
  const latest = [...latestMap.values()].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

  return Promise.all(latest.map(toDTO));
}

export async function getMessageHistory(messageID: string): Promise<MessageSnapshotDTO[]> {
  const snapshots = await MessageSnapshot.findAll({
    where: { messageID },
    order: [["version", "ASC"]],
  });
  return Promise.all(snapshots.map(toDTO));
}
