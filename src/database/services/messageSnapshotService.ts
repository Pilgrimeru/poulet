import { Op } from "sequelize";
import { MessageAttachment, MessageSnapshot, MessageSnapshotAttributes } from "@/database/models";

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

export interface AttachmentDTO {
  id: string;
  snapshotId: string;
  attachmentID: string;
  filename: string;
  url: string;
  contentType: string;
  size: number;
}

const RETENTION_DAYS = parseInt(process.env["MESSAGE_RETENTION_DAYS"] ?? "7", 10);

class MessageSnapshotService {
  async saveSnapshot(
    data: Omit<MessageSnapshotAttributes, "id" | "snapshotAt" | "isDeleted" | "version">,
    attachments: Omit<AttachmentDTO, "id" | "snapshotId">[],
    version: number,
    isDeleted = false,
  ): Promise<MessageSnapshot> {
    const snapshot = await MessageSnapshot.create({
      ...data,
      snapshotAt: Date.now(),
      isDeleted,
      version,
    });

    if (attachments.length > 0) {
      await MessageAttachment.bulkCreate(
        attachments.map((a) => ({ ...a, snapshotId: snapshot.id })),
      );
    }

    return snapshot;
  }

  async getNextVersion(messageID: string): Promise<number> {
    const count = await MessageSnapshot.count({ where: { messageID } });
    return count;
  }

  async markDeleted(messageID: string): Promise<void> {
    const latest = await MessageSnapshot.findOne({
      where: { messageID },
      order: [["version", "DESC"]],
    });
    if (!latest) return;

    await this.saveSnapshot(
      {
        messageID: latest.messageID,
        channelID: latest.channelID,
        guildID: latest.guildID,
        authorID: latest.authorID,
        authorUsername: latest.authorUsername,
        authorDisplayName: latest.authorDisplayName,
        authorAvatarURL: latest.authorAvatarURL,
        content: latest.content,
        createdAt: latest.createdAt,
      },
      [],
      latest.version + 1,
      true,
    );
  }

  async getMessageHistory(messageID: string): Promise<MessageSnapshotDTO[]> {
    const snapshots = await MessageSnapshot.findAll({
      where: { messageID },
      order: [["version", "ASC"]],
    });

    return Promise.all(snapshots.map((s) => this.toDTO(s)));
  }

  async getChannelMessages(
    guildID: string,
    channelID: string,
    limit = 100,
    before?: number,
  ): Promise<MessageSnapshotDTO[]> {
    // Return only the latest version of each message
    const where: any = { guildID, channelID };
    if (before) where.snapshotAt = { [Op.lt]: before };

    const snapshots = await MessageSnapshot.findAll({
      where,
      order: [["snapshotAt", "DESC"]],
      limit: limit * 10, // fetch more to deduplicate by messageID
    });

    // Keep only latest version per messageID
    const seen = new Set<string>();
    const latest: MessageSnapshot[] = [];
    for (const s of snapshots) {
      if (!seen.has(s.messageID)) {
        seen.add(s.messageID);
        latest.push(s);
        if (latest.length >= limit) break;
      }
    }

    return Promise.all(latest.map((s) => this.toDTO(s)));
  }

  async purgeOldSnapshots(): Promise<number> {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

    // First delete attachments linked to old snapshots
    const oldSnapshots = await MessageSnapshot.findAll({
      where: { snapshotAt: { [Op.lt]: cutoff } },
      attributes: ["id"],
    });

    const oldIds = oldSnapshots.map((s) => s.id);
    if (oldIds.length > 0) {
      await MessageAttachment.destroy({ where: { snapshotId: { [Op.in]: oldIds } } });
    }

    const deleted = await MessageSnapshot.destroy({
      where: { snapshotAt: { [Op.lt]: cutoff } },
    });

    return deleted;
  }

  private async toDTO(snapshot: MessageSnapshot): Promise<MessageSnapshotDTO> {
    const attachments = await MessageAttachment.findAll({
      where: { snapshotId: snapshot.id },
    });

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
}

export const messageSnapshotService = new MessageSnapshotService();
