import type { ChannelEntry, GuildEntry, MessageSnapshotDTO } from "../types";

const BASE = process.env["NEXT_PUBLIC_API_BASE_URL"] ?? "";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export function fetchGuilds(): Promise<GuildEntry[]> {
  return get("/api/guilds");
}

export function fetchChannels(guildID: string): Promise<ChannelEntry[]> {
  return get(`/api/guilds/${guildID}/channels`);
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
  return get(`/api/channels/${channelID}/messages?${params}`);
}

export function fetchHistory(messageID: string): Promise<MessageSnapshotDTO[]> {
  return get(`/api/messages/${messageID}/history`);
}
