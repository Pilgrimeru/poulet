import path from "path";
import { config as dotenvConfig } from "dotenv";
import { Op } from "sequelize";
import type { ChannelEntry, GuildEntry, MessageSnapshotDTO } from "@/types";
import { ChannelMeta } from "@/models/ChannelMeta";
import type { UserMeta } from "@/services/statsService";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const CACHE_TTL_MS = 60_000;

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
};

type DiscordChannel = {
  id: string;
  name: string;
  parent_id: string | null;
  type: number;
};

type DiscordUser = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
};

type DiscordGuildMember = {
  nick?: string | null;
  avatar?: string | null;
  user?: DiscordUser;
};

const globalForDiscordMeta = globalThis as typeof globalThis & { __discordMetaEnvLoaded?: boolean };
const cache = new Map<string, CacheEntry<unknown>>();

function ensureEnvLoaded(): void {
  if (globalForDiscordMeta.__discordMetaEnvLoaded) return;
  dotenvConfig({ path: path.resolve(process.cwd(), "config.env"), quiet: true });
  dotenvConfig({ path: path.resolve(process.cwd(), "../config.env"), override: false, quiet: true });
  globalForDiscordMeta.__discordMetaEnvLoaded = true;
}

function getToken(): string | null {
  ensureEnvLoaded();
  return process.env["TOKEN"] ?? null;
}

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

function getStaleCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  return entry.value as T;
}

function setCached<T>(key: string, value: T): T {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

async function discordGet<T>(pathname: string, cacheKey: string): Promise<T | null> {
  const cached = getCached<T | null>(cacheKey);
  if (cached !== null) return cached;
  const staleCached = getStaleCached<T | null>(cacheKey);

  const token = getToken();
  if (!token) return staleCached ?? setCached(cacheKey, null);

  let response: Response;

  try {
    response = await fetch(`${DISCORD_API_BASE}${pathname}`, {
      headers: {
        Authorization: `Bot ${token}`,
      },
      cache: "no-store",
    });
  } catch {
    if (staleCached !== null) return staleCached;
    throw new Error(`Discord API request failed on ${pathname}`);
  }

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return setCached(cacheKey, null);
  }

  if (!response.ok) {
    if (staleCached !== null) return staleCached;
    throw new Error(`Discord API ${response.status} on ${pathname}`);
  }

  return setCached(cacheKey, await response.json() as T);
}

function imageExtension(hash: string): string {
  return hash.startsWith("a_") ? "gif" : "png";
}

function guildIconURL(guildID: string, iconHash: string | null): string {
  if (!iconHash) return "";
  return `https://cdn.discordapp.com/icons/${guildID}/${iconHash}.${imageExtension(iconHash)}?size=128`;
}

function userAvatarURL(userID: string, avatarHash: string | null): string {
  if (!avatarHash) return "";
  return `https://cdn.discordapp.com/avatars/${userID}/${avatarHash}.${imageExtension(avatarHash)}?size=128`;
}

function memberAvatarURL(guildID: string, userID: string, avatarHash: string | null | undefined): string {
  if (!avatarHash) return "";
  return `https://cdn.discordapp.com/guilds/${guildID}/users/${userID}/avatars/${avatarHash}.${imageExtension(avatarHash)}?size=128`;
}

async function fetchGuild(guildID: string): Promise<DiscordGuild | null> {
  return discordGet<DiscordGuild>(`/guilds/${guildID}`, `guild:${guildID}`);
}

async function fetchGuildChannels(guildID: string): Promise<DiscordChannel[] | null> {
  return discordGet<DiscordChannel[]>(`/guilds/${guildID}/channels`, `channels:${guildID}`);
}

async function fetchGuildMember(guildID: string, userID: string): Promise<DiscordGuildMember | null> {
  return discordGet<DiscordGuildMember>(`/guilds/${guildID}/members/${userID}`, `member:${guildID}:${userID}`);
}

async function fetchUser(userID: string): Promise<DiscordUser | null> {
  return discordGet<DiscordUser>(`/users/${userID}`, `user:${userID}`);
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function hydrateGuildEntries(fallbackGuilds: GuildEntry[]): Promise<GuildEntry[]> {
  return mapWithConcurrency(fallbackGuilds, 5, async (fallbackGuild) => {
    try {
      const guild = await fetchGuild(fallbackGuild.guildID);
      if (!guild) return fallbackGuild;
      return {
        guildID: fallbackGuild.guildID,
        name: guild.name || fallbackGuild.name,
        iconURL: guildIconURL(guild.id, guild.icon) || fallbackGuild.iconURL,
      };
    } catch {
      return fallbackGuild;
    }
  });
}

export async function hydrateChannelEntries(guildID: string, fallbackChannels: ChannelEntry[]): Promise<ChannelEntry[]> {
  try {
    const channels = await fetchGuildChannels(guildID);
    if (!channels) return fallbackChannels;

    const channelMap = new Map(channels.map((channel) => [channel.id, channel]));

    return fallbackChannels.map((fallbackChannel) => {
      const channel = channelMap.get(fallbackChannel.channelID);
      const parent = fallbackChannel.parentID ? channelMap.get(fallbackChannel.parentID) : null;

      if (!channel) {
        return {
          ...fallbackChannel,
          parentName: parent?.name ?? fallbackChannel.parentName,
        };
      }

      return {
        channelID: fallbackChannel.channelID,
        channelName: channel.name || fallbackChannel.channelName,
        parentID: channel.parent_id ?? fallbackChannel.parentID,
        parentName: parent?.name ?? fallbackChannel.parentName,
        channelType: channel.type ?? fallbackChannel.channelType,
      };
    });
  } catch {
    return fallbackChannels;
  }
}

export async function hydrateChannelValues<T extends { channelID: string }>(
  guildID: string,
  rows: T[],
): Promise<Array<T & { channelName: string; parentID: string | null; parentName: string | null; channelType: number | null }>> {
  if (rows.length === 0) return [];

  const channelIDs = [...new Set(rows.map((row) => row.channelID))];
  const fallbackMetas = await ChannelMeta.findAll({
    attributes: ["channelID", "name", "parentID", "parentName", "channelType"],
    where: {
      guildID,
      channelID: { [Op.in]: channelIDs },
    },
  });

  const fallbackMap = new Map(fallbackMetas.map((meta) => [meta.channelID, meta]));

  try {
    const channels = await fetchGuildChannels(guildID);
    const channelMap = new Map(channels?.map((channel) => [channel.id, channel]) ?? []);

    return rows.map((row) => {
      const channel = channelMap.get(row.channelID);
      const fallback = fallbackMap.get(row.channelID);
      const parentID = channel?.parent_id ?? fallback?.parentID ?? null;
      const parentName = (parentID ? channelMap.get(parentID)?.name : null) ?? fallback?.parentName ?? null;
      return {
        ...row,
        channelName: channel?.name ?? fallback?.name ?? row.channelID,
        parentID,
        parentName,
        channelType: channel?.type ?? fallback?.channelType ?? null,
      };
    });
  } catch {
    return rows.map((row) => {
      const fallback = fallbackMap.get(row.channelID);
      return {
        ...row,
        channelName: fallback?.name ?? row.channelID,
        parentID: fallback?.parentID ?? null,
        parentName: fallback?.parentName ?? null,
        channelType: fallback?.channelType ?? null,
      };
    });
  }
}

export async function getCurrentUserMeta(guildID: string, userID: string): Promise<UserMeta | null> {
  try {
    const member = await fetchGuildMember(guildID, userID);
    const memberUser = member?.user;

    if (memberUser) {
      return {
        userID,
        username: memberUser.username,
        displayName: member?.nick || memberUser.global_name || memberUser.username,
        avatarURL: memberAvatarURL(guildID, userID, member?.avatar) || userAvatarURL(userID, memberUser.avatar),
      };
    }
  } catch {
    // Fall through to the global user endpoint when guild member hydration fails transiently.
  }

  try {
    const user = await fetchUser(userID);
    if (!user) return null;

    return {
      userID,
      username: user.username,
      displayName: user.global_name || user.username,
      avatarURL: userAvatarURL(userID, user.avatar),
    };
  } catch {
    return null;
  }
}

export async function hydrateUserMetas(
  guildID: string,
  userIDs: string[],
  fallbackMetas: Map<string, UserMeta>,
): Promise<Map<string, UserMeta>> {
  const hydrated = await mapWithConcurrency(userIDs, 8, async (userID) => {
    const fallback = fallbackMetas.get(userID);
    const current = await getCurrentUserMeta(guildID, userID);
    return [
      userID,
      current ?? fallback ?? {
        userID,
        username: "",
        displayName: "",
        avatarURL: "",
      },
    ] as const;
  });

  return new Map(hydrated);
}

export async function hydrateMessagesWithCurrentAuthors(
  guildID: string,
  messages: MessageSnapshotDTO[],
): Promise<MessageSnapshotDTO[]> {
  const fallbackMetas = new Map<string, UserMeta>();

  for (const message of messages) {
    if (!fallbackMetas.has(message.authorID)) {
      fallbackMetas.set(message.authorID, {
        userID: message.authorID,
        username: message.authorUsername,
        displayName: message.authorDisplayName,
        avatarURL: message.authorAvatarURL,
      });
    }
  }

  const currentMetas = await hydrateUserMetas(guildID, [...fallbackMetas.keys()], fallbackMetas);

  return messages.map((message) => {
    const current = currentMetas.get(message.authorID);
    if (!current) return message;

    return {
      ...message,
      authorUsername: current.username || message.authorUsername,
      authorDisplayName: current.displayName || message.authorDisplayName,
      authorAvatarURL: current.avatarURL || message.authorAvatarURL,
    };
  });
}
