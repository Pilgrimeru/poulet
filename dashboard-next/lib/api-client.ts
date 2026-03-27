import type { ChannelEntry, GuildEntry, MessageSnapshotDTO } from "../types";
import { getJson } from "./http";

export function fetchGuilds(): Promise<GuildEntry[]> {
  return getJson("/api/guilds");
}

export function fetchChannels(guildID: string): Promise<ChannelEntry[]> {
  return getJson(`/api/guilds/${guildID}/channels`);
}

export interface FetchMessagesFilter {
  before?: number;
  after?: number;
  search?: string;
  authorID?: string;
  onlyDeleted?: boolean;
}

export function fetchMessages(
  guildID: string,
  channelID: string,
  limit = 50,
  filter: FetchMessagesFilter = {},
): Promise<MessageSnapshotDTO[]> {
  const params = new URLSearchParams({ guildId: guildID, limit: String(limit) });
  if (filter.before !== undefined)  params.set("before",      String(filter.before));
  if (filter.after  !== undefined)  params.set("after",       String(filter.after));
  if (filter.search)                params.set("search",      filter.search);
  if (filter.authorID)              params.set("authorID",    filter.authorID);
  if (filter.onlyDeleted)           params.set("onlyDeleted", "true");
  return getJson(`/api/channels/${channelID}/messages?${params}`);
}

export function fetchHistory(messageID: string): Promise<MessageSnapshotDTO[]> {
  return getJson(`/api/messages/${messageID}/history`);
}
