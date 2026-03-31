import { apiGet, apiPost } from "./client";

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
  referencedMessageID: string | null;
  referencedMessageContent: string | null;
  referencedMessageAuthor: string | null;
}

export interface GetUserMessagesOptions {
  startDate?: number;
  endDate?: number;
  onlyDeleted?: boolean;
  channelID?: string;
  limit?: number;
  search?: string;
  searchTerms?: string[];
  searchMode?: "any" | "all";
}

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
  async getUserMessages(
    guildID: string,
    userID: string,
    options: GetUserMessagesOptions = {},
  ): Promise<MessageSnapshotDTO[]> {
    const params = new URLSearchParams();
    if (options.limit)       params.set("limit",       String(options.limit));
    if (options.startDate)   params.set("startDate",   String(options.startDate));
    if (options.endDate)     params.set("endDate",     String(options.endDate));
    if (options.onlyDeleted) params.set("onlyDeleted", "true");
    if (options.channelID)   params.set("channelID",   options.channelID);
    if (options.search)      params.set("search",      options.search);
    if (options.searchTerms?.length) params.set("searchTerms", JSON.stringify(options.searchTerms));
    if (options.searchMode)  params.set("searchMode",  options.searchMode);
    const qs = params.size > 0 ? `?${params.toString()}` : "";
    console.log("[messageSnapshotService] getUserMessages", {
      guildID,
      userID,
      options,
      path: `/guilds/${guildID}/users/${userID}/messages${qs}`,
    });
    return apiGet<MessageSnapshotDTO[]>(`/guilds/${guildID}/users/${userID}/messages${qs}`);
  },

  async getMessageHistory(messageID: string): Promise<MessageSnapshotDTO[]> {
    return apiGet<MessageSnapshotDTO[]>(`/messages/${messageID}/history`);
  },

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
