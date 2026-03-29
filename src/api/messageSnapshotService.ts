import { apiPost } from "./client";

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
  referencedMessageID?: string | null;
  referencedMessageContent?: string | null;
  referencedMessageAuthor?: string | null;
}

export const messageSnapshotService = {
  async saveSnapshot(
    data: SaveSnapshotInput,
    attachments: AttachmentInput[],
    version?: number,
    isDeleted = false,
  ): Promise<void> {
    await apiPost("/messages/snapshot", { data, attachments, version, isDeleted });
  },

  async markDeleted(messageID: string): Promise<void> {
    await apiPost(`/messages/${messageID}/mark-deleted`);
  },

  async purgeOldSnapshots(): Promise<number> {
    const result = await apiPost<{ deleted: number }>("/messages/purge");
    return result.deleted;
  },
};
