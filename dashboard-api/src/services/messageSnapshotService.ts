import { createWriteStream, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { col, fn, Op } from "sequelize";
import { ChannelMeta } from "../db/models/ChannelMeta";
import { GuildMeta } from "../db/models/GuildMeta";
import { MessageAttachment } from "../db/models/MessageAttachment";
import { MessageSnapshot } from "../db/models/MessageSnapshot";

const ATTACHMENTS_DIR = join(__dirname, "../../../database/attachments");
const RETENTION_DAYS = Number.parseInt(process.env["MESSAGE_RETENTION_DAYS"] ?? "7", 10);

export interface AttachmentInput {
  attachmentID: string;
  filename: string;
  url: string;
  contentType: string;
  size: number;
}

export interface SaveSnapshotInput {
  messageID: string;
  channelID: string;
  guildID: string;
  authorID: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarURL: string;
  content: string;
  createdAt: number;
}

async function downloadAttachment(url: string, dir: string, filename: string): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const destPath = join(dir, filename);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const writer = createWriteStream(destPath);
  await pipeline(res.body as unknown as NodeJS.ReadableStream, writer);
  return destPath;
}

export async function saveSnapshot(
  data: SaveSnapshotInput,
  attachments: AttachmentInput[],
  version: number,
  isDeleted = false,
): Promise<void> {
  const snapshot = await MessageSnapshot.create({
    ...data,
    snapshotAt: Date.now(),
    isDeleted,
    version,
  } as any);

  if (attachments.length > 0) {
    const dir = join(ATTACHMENTS_DIR, data.messageID);
    const saved = await Promise.all(
      attachments.map(async (a) => {
        let localUrl = a.url;
        try {
          await downloadAttachment(a.url, dir, a.attachmentID + "_" + a.filename);
          localUrl = `/attachments/${data.messageID}/${a.attachmentID}_${a.filename}`;
        } catch (err) {
          console.warn(`[snapshots] Could not download attachment ${a.filename}:`, err);
        }
        return { ...a, url: localUrl, snapshotId: (snapshot as any).id };
      }),
    );
    await MessageAttachment.bulkCreate(saved as any);
  }
}

export async function getNextVersion(messageID: string): Promise<number> {
  return MessageSnapshot.count({ where: { messageID } });
}

export async function markDeleted(messageID: string): Promise<void> {
  const latest = await MessageSnapshot.findOne({
    where: { messageID },
    order: [["version", "DESC"]],
  });
  if (!latest) return;

  const existingAttachments = await MessageAttachment.findAll({ where: { snapshotId: (latest as any).id } });

  const snapshot = await MessageSnapshot.create({
    messageID: latest.messageID,
    channelID: latest.channelID,
    guildID: latest.guildID,
    authorID: latest.authorID,
    authorUsername: latest.authorUsername,
    authorDisplayName: latest.authorDisplayName,
    authorAvatarURL: latest.authorAvatarURL,
    content: latest.content,
    createdAt: latest.createdAt,
    snapshotAt: Date.now(),
    isDeleted: true,
    version: latest.version + 1,
  } as any);

  if (existingAttachments.length > 0) {
    await MessageAttachment.bulkCreate(
      existingAttachments.map((a: any) => ({
        snapshotId: (snapshot as any).id,
        attachmentID: a.attachmentID,
        filename: a.filename,
        url: a.url,
        contentType: a.contentType,
        size: a.size,
      })) as any,
    );
  }
}

export async function purgeOldSnapshots(): Promise<number> {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  const oldSnapshots = await MessageSnapshot.findAll({
    where: { snapshotAt: { [Op.lt]: cutoff } },
    attributes: ["id", "messageID"],
  });

  const oldIds = oldSnapshots.map((s: any) => s.id);
  if (oldIds.length > 0) {
    const oldMessageIDs = [...new Set(oldSnapshots.map((s: any) => s.messageID))];
    for (const messageID of oldMessageIDs) {
      const dir = join(ATTACHMENTS_DIR, messageID);
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
    await MessageAttachment.destroy({ where: { snapshotId: { [Op.in]: oldIds } } });
  }

  return MessageSnapshot.destroy({ where: { snapshotAt: { [Op.lt]: cutoff } } });
}

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

export async function getDistinctChannels(guildID: string): Promise<{ channelID: string; channelName: string; parentID: string | null; parentName: string | null; channelType: number | null }[]> {
  const rows = await MessageSnapshot.findAll({
    attributes: [[fn("DISTINCT", col("channelID")), "channelID"]],
    where: { guildID },
    raw: true,
  }) as unknown as { channelID: string }[];

  const results = await Promise.all(rows.map(async ({ channelID }) => {
    const meta = await ChannelMeta.findByPk(channelID);
    return {
      channelID,
      channelName: meta?.name ?? "",
      parentID: meta?.parentID ?? null,
      parentName: meta?.parentName ?? null,
      channelType: meta?.channelType ?? null,
    };
  }));

  // Inject virtual parent entries for forums/categories that have no snapshots themselves
  // (e.g. forum channels whose posts are threads)
  const existingIDs = new Set(results.map((r) => r.channelID));
  const virtualParents = new Map<string, { channelID: string; channelName: string; parentID: string | null; parentName: string | null; channelType: number | null }>();

  for (const r of results) {
    if (r.parentID && !existingIDs.has(r.parentID) && !virtualParents.has(r.parentID)) {
      const parentMeta = await ChannelMeta.findByPk(r.parentID);
      if (parentMeta) {
        virtualParents.set(r.parentID, {
          channelID: r.parentID,
          channelName: parentMeta.name,
          parentID: parentMeta.parentID ?? null,
          parentName: parentMeta.parentName ?? null,
          channelType: parentMeta.channelType ?? null,
        });
      }
    }
  }

  return [...virtualParents.values(), ...results];
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
