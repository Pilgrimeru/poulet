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

export interface GuildEntry {
  guildID: string;
  name: string;
  iconURL: string;
}

export interface ChannelEntry {
  channelID: string;
  channelName: string;
  parentID: string | null;
  parentName: string | null;
  channelType: number | null;
}

// Discord ChannelType values
export const ChannelType = {
  GuildText: 0,
  GuildCategory: 4,
  PublicThread: 11,
  PrivateThread: 12,
  GuildForum: 15,
  GuildMedia: 16,
} as const;
