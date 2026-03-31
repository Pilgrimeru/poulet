import { channelMetaService } from "@/api/channelMetaService";
import { guildSettingsService } from "@/api/guildSettingsService";
import { messageSnapshotService } from "@/api/messageSnapshotService";
import { sanctionApiService } from "@/api/sanctionApiService";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  GuildChannelsToolSchema,
  HistoryQueryToolSchema,
  SearchQueryToolSchema,
  UserSanctionsToolSchema,
} from "../moderation/schemas";
import type { ChannelsQuery, HistoryQuery, SanctionsQuery } from "../moderation/types";

export const duckduckgoTool = new DuckDuckGoSearch({ maxResults: 3 });

function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeHistoryQuery(query: HistoryQuery): HistoryQuery {
  const searchTerms = Array.isArray(query.searchTerms)
    ? query.searchTerms.map((term) => String(term).trim()).filter(Boolean)
    : [];

  return {
    ...query,
    startAt: query.startAt?.trim() ? query.startAt.trim() : null,
    endAt: query.endAt?.trim() ? query.endAt.trim() : null,
    search: query.search?.trim() ? query.search.trim() : null,
    searchTerms: searchTerms.length > 0 ? searchTerms : null,
    searchMode: query.searchMode === "all" ? "all" : "any",
  };
}

function createUtcDateFromParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
}

function parseLocalDateTimeTag(value: string): { year: number; month: number; day: number; hour: number; minute: number } | null {
  const match = new RegExp(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/).exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
}

function resolveHistoryWindow(query: HistoryQuery): { startDate: number | null; endDate: number | null } {
  const normalized = normalizeHistoryQuery(query);
  const startParts = normalized.startAt ? parseLocalDateTimeTag(normalized.startAt) : null;
  const endParts = normalized.endAt ? parseLocalDateTimeTag(normalized.endAt) : null;

  if (!startParts && !endParts) {
    return { startDate: null, endDate: null };
  }

  const start = startParts
    ? createUtcDateFromParts(startParts.year, startParts.month, startParts.day, startParts.hour, startParts.minute, 0)
    : null;
  const end = endParts
    ? createUtcDateFromParts(endParts.year, endParts.month, endParts.day, endParts.hour, endParts.minute, 59)
    : null;

  return {
    startDate: start?.getTime() ?? null,
    endDate: end?.getTime() ?? null,
  };
}

export async function fetchHistoryToolResult(guildID: string, q: HistoryQuery): Promise<string> {
  const normalizedQuery = normalizeHistoryQuery(q);
  const resolvedWindow = resolveHistoryWindow(normalizedQuery);
  const channels = await channelMetaService.listByGuild(guildID).catch(() => []);
  const channelNamesById = new Map(channels.map((channel) => [channel.channelID, channel.channelName]));

  console.log("[ai] historyQuery args", {
    raw: q,
    normalized: normalizedQuery,
    resolvedWindow,
  });

  const history = await messageSnapshotService.getUserMessages(guildID, normalizedQuery.userID, {
    startDate: resolvedWindow.startDate ?? undefined,
    endDate: resolvedWindow.endDate ?? undefined,
    onlyDeleted: normalizedQuery.onlyDeleted,
    channelID: normalizedQuery.channelID ?? undefined,
    search: normalizedQuery.search ?? undefined,
    searchTerms: normalizedQuery.searchTerms ?? undefined,
    searchMode: normalizedQuery.searchMode ?? undefined,
    limit: normalizedQuery.limit,
  });

  console.log("[ai] historyQuery raw result", history);

  const header =
    `[Outil: Historique utilisateur — args: ${JSON.stringify(normalizedQuery)}, window: ${JSON.stringify(resolvedWindow)}, ${history.length} messages]\n`;
  if (history.length === 0) return `${header}Aucun message trouve.`;

  const editedMessages = history.filter((message) => !message.isDeleted && message.version > 1);
  const historiesById = new Map<string, Awaited<ReturnType<typeof messageSnapshotService.getUserMessages>>>();

  await Promise.all(
    editedMessages.map(async (message) => {
      const versions = await messageSnapshotService.getMessageHistory(message.messageID).catch(() => null);
      if (versions && versions.length > 1) historiesById.set(message.messageID, versions);
    }),
  );

  const formatted = history.map((message) => {
    const flags: string[] = [];
    if (message.isDeleted) flags.push("SUPPRIME");
    else if (message.version > 1) flags.push("EDITE");

    const suffix = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
    const channelName = channelNamesById.get(message.channelID);
    const renderedChannel = channelName
      ? `<#${message.channelID}> (#${channelName})`
      : `<#${message.channelID}>`;
    const line = `[${new Date(message.createdAt).toISOString()}] ${renderedChannel} ${message.authorUsername}: ${message.content}${suffix}`;
    const versions = historiesById.get(message.messageID);
    if (!versions) return line;

    const previousVersions = versions
      .slice(0, -1)
      .map((version) => `  > v${version.version + 1}: ${version.content}`)
      .join("\n");

    return `${line}\n${previousVersions}`;
  }).join("\n");

  return header + formatted;
}

export async function fetchSanctionsToolResult(guildID: string, q: SanctionsQuery): Promise<string> {
  const settings = await guildSettingsService.getByGuildID(guildID).catch(() => null);
  const sanctionDurationMs = (settings as unknown as { sanctionDurationMs?: number | null })?.sanctionDurationMs ?? null;
  const sanctions = await sanctionApiService.list(guildID, { userID: q.userID, state: "created" });
  const now = Date.now();
  const active = sanctions.filter((sanction) => {
    if (sanction.durationMs === null && sanctionDurationMs === null) return true;
    if (sanction.durationMs === null) return now - sanction.createdAt < sanctionDurationMs!;
    return now - sanction.createdAt < sanction.durationMs;
  });

  const limited = active
    .toSorted((a, b) => b.createdAt - a.createdAt)
    .slice(0, Math.max(1, Math.min(q.limit, 50)));

  console.log("[ai] userSanctions args", q);
  console.log("[ai] userSanctions raw result", limited);

  if (limited.length === 0) {
    return `[Outil: Sanctions utilisateur — args: ${JSON.stringify(q)}, 0 sanctions]\nAucune sanction trouvee.`;
  }

  const formatted = limited.map((sanction) =>
    [
      `- id=${sanction.id}`,
      `date=${new Date(sanction.createdAt).toISOString()}`,
      `type=${sanction.type}`,
      `severity=${sanction.severity}`,
      `nature=${sanction.nature}`,
      `state=${sanction.state}`,
      `reason=${sanction.reason}`,
      `durationMs=${sanction.durationMs ?? "null"}`,
    ].join(" | "),
  ).join("\n");

  return `[Outil: Sanctions utilisateur — args: ${JSON.stringify(q)}, ${limited.length} sanctions]\n${formatted}`;
}

export async function fetchChannelsToolResult(guildID: string, q: ChannelsQuery): Promise<string> {
  const channels = await channelMetaService.listByGuild(guildID);
  const query = normalizeSearchText(q.nameQuery);
  const filtered = query
    ? channels.filter((channel) =>
        normalizeSearchText(channel.channelName).includes(query) ||
        normalizeSearchText(channel.parentName).includes(query),
      )
    : channels;

  const limited = filtered.slice(0, Math.max(1, Math.min(q.limit, 100)));

  console.log("[ai] guildChannels args", q);
  console.log("[ai] guildChannels raw result", limited);

  if (limited.length === 0) {
    return `[Outil: Salons du serveur — args: ${JSON.stringify(q)}, 0 salons]\nAucun salon trouve.`;
  }

  const formatted = limited
    .map((channel) => `- ${channel.channelName} | parent=${channel.parentName ?? "aucun"}`)
    .join("\n");

  return `[Outil: Salons du serveur — args: ${JSON.stringify(q)}, ${limited.length} salons]\n${formatted}`;
}

export async function executeModerationToolCall(
  guildID: string,
  name: string,
  args: unknown,
): Promise<string> {
  if (name === "historyQuery") {
    return fetchHistoryToolResult(guildID, args as HistoryQuery);
  }
  if (name === "searchQuery") {
    const search = await duckduckgoTool.invoke((args as { query: string }).query);
    return typeof search === "string" ? search : JSON.stringify(search);
  }
  if (name === "userSanctions") {
    return fetchSanctionsToolResult(guildID, args as SanctionsQuery);
  }
  if (name === "guildChannels") {
    return fetchChannelsToolResult(guildID, args as ChannelsQuery);
  }
  return `Outil inconnu: ${name}`;
}

export function createModerationTools(guildID: string) {
  const historyTool = tool(
    (query: HistoryQuery) => fetchHistoryToolResult(guildID, query),
    {
      name: "historyQuery",
      description: "Consulte l'historique des messages d'un utilisateur dans la base de donnees du serveur. Privilegie des recherches larges: variantes orthographiques, mots racines, plusieurs termes, et mode 'any' pour ne pas rater des messages pertinents.",
      schema: HistoryQueryToolSchema,
    },
  );

  const searchTool = tool(
    async ({ query }: z.infer<typeof SearchQueryToolSchema>) => {
      const result = await duckduckgoTool.invoke(query);
      return typeof result === "string" ? result : JSON.stringify(result);
    },
    {
      name: "searchQuery",
      description: "Lance une recherche DuckDuckGo pour verifier des faits externes ou du jargon ambigu.",
      schema: SearchQueryToolSchema,
    },
  );

  const sanctionsTool = tool(
    (query: SanctionsQuery) => fetchSanctionsToolResult(guildID, query),
    {
      name: "userSanctions",
      description: "Recupere uniquement les sanctions actives d'un utilisateur. Utilise cet outil pour verifier une recidive ou eviter de redemander une information deja disponible.",
      schema: UserSanctionsToolSchema,
    },
  );

  const channelsTool = tool(
    (query: ChannelsQuery) => fetchChannelsToolResult(guildID, query),
    {
      name: "guildChannels",
      description: "Liste les salons actuels du serveur directement depuis l'API Discord, avec leur nom et leur categorie parente. Utilise cet outil pour retrouver des noms de salons sans demander d'ID a l'utilisateur.",
      schema: GuildChannelsToolSchema,
    },
  );

  return [historyTool, searchTool, sanctionsTool, channelsTool];
}
