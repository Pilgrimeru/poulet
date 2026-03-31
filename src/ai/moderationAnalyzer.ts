import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { ContextMessage } from "@/api/flaggedMessageApiService";
import { channelMetaService } from "@/api/channelMetaService";
import { guildSettingsService } from "@/api/guildSettingsService";
import { messageSnapshotService } from "@/api/messageSnapshotService";
import { sanctionApiService } from "@/api/sanctionApiService";
import { fallbackLLM, moderationLLM } from "./client";
import {
  FlagAnalysisResult,
  FlagAnalysisSchema,
  flagSystemPrompt,
  QuestionResult,
  QuestionSchema,
  questionSystemPrompt,
  SummaryResult,
  SummarySchema,
  summarySystemPrompt,
} from "./prompts";
import { duckduckgoTool } from "./tools";

export interface FlagAnalysisInput {
  guildID: string;
  reporterID: string;
  reporterUsername?: string | null;
  reporterDisplayName?: string | null;
  targetUserID: string;
  targetUsername?: string | null;
  targetDisplayName?: string | null;
  priorSanctions?: Array<{
    id: string;
    type: string;
    severity: string;
    nature: string;
    reason: string;
    state: string;
    createdAt: number;
  }>;
  messageMentions?: Array<{ id: string; username?: string | null; displayName?: string | null }>;
  messageContent: string;
  contextMessages: ContextMessage[];
}

export interface ReportAnalysisInput {
  guildID: string;
  reporterID: string;
  targetUserID: string;
  transcript: string;
  priorSanctions?: Array<{
    id: string;
    type: string;
    severity: string;
    nature: string;
    reason: string;
    state: string;
    createdAt: number;
  }>;
}

type HistoryQuery = {
  userID: string;
  startAt: string | null;
  endAt: string | null;
  onlyDeleted: boolean;
  channelID: string | null;
  search: string | null;
  searchTerms: string[] | null;
  searchMode: "any" | "all" | null;
  limit: number;
};

type SanctionsQuery = {
  userID: string;
  limit: number;
};

type ChannelsQuery = {
  nameQuery: string | null;
  limit: number;
};

type StructuredSchema<T> = z.ZodType<T>;

const MAX_TOOL_ITERATIONS = 3;
const SOURCE_REPORT_TIMEZONE = "Europe/Paris";

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

function getCandidateLLMs() {
  const candidates = [moderationLLM, fallbackLLM].filter((llm): llm is NonNullable<typeof moderationLLM> => Boolean(llm));
  if (candidates.length === 0) throw new Error("OPENROUTER_API_KEY is not configured");
  return candidates.filter((llm, index, arr) => arr.findIndex((candidate) => candidate === llm) === index);
}

function normalizeValue(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeSeverity(value: unknown): unknown {
  const normalized = normalizeValue(value).replaceAll(/[\s-]+/g, "_");
  if (normalized === "low" || normalized === "faible") return "LOW";
  if (normalized === "medium" || normalized === "moyen" || normalized === "modere" || normalized === "moderee") return "MEDIUM";
  if (normalized === "high" || normalized === "grave" || normalized === "eleve" || normalized === "elevee") return "HIGH";
  if (normalized === "unforgivable" || normalized === "impardonnable") return "UNFORGIVABLE";
  return value;
}

function normalizeNature(value: unknown): unknown {
  const normalized = normalizeValue(value).replaceAll(/[\s_-]+/g, "");
  if (["extremism", "extremisme"].includes(normalized)) return "Extremism";
  if (["violence"].includes(normalized)) return "Violence";
  if (["hate", "haine"].includes(normalized)) return "Hate";
  if (["harassment", "harcelement", "harcelementcible", "insulte", "injure", "agressionverbale"].includes(normalized)) return "Harassment";
  if (["spam", "flood"].includes(normalized)) return "Spam";
  if (["manipulation", "negationnisme", "doxxing", "contournement"].includes(normalized)) return "Manipulation";
  if (["recidivism", "recidive"].includes(normalized)) return "Recidivism";
  if (["other", "autre", "unknown", "misc", "miscellaneous"].includes(normalized)) return "Other";
  return value;
}

function normalizeStructuredPayload(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const payload = { ...(value as Record<string, unknown>) };

  if ("severity" in payload) payload["severity"] = normalizeSeverity(payload["severity"]);
  if ("nature" in payload) payload["nature"] = normalizeNature(payload["nature"]);

  if ("searchQuery" in payload && payload["searchQuery"] !== null && typeof payload["searchQuery"] !== "string") {
    payload["searchQuery"] = null;
  }

  if ("historyQuery" in payload && payload["historyQuery"] !== null && typeof payload["historyQuery"] !== "object") {
    payload["historyQuery"] = null;
  }

  if (
    "sanctionKind" in payload &&
    payload["sanctionKind"] !== "WARN" &&
    payload["sanctionKind"] !== "MUTE" &&
    payload["sanctionKind"] !== "BAN_PENDING"
  ) {
    payload["sanctionKind"] = "WARN";
  }

  if ("similarSanctionIDs" in payload && !Array.isArray(payload["similarSanctionIDs"])) {
    payload["similarSanctionIDs"] = [];
  }

  return payload;
}

function logMessages(label: string, messages: BaseMessage[]): void {
  console.log(`[ai] ${label}`);
  for (const msg of messages) {
    const role = msg.constructor.name.replace("Message", "").toLowerCase();
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    console.log(`  [${role}] ${content}`);
  }
}

type TranscriptEntry = {
  timestamp: Date;
  author: string;
  content: string;
  isBot: boolean;
};

function parseTranscriptEntries(transcript: string): TranscriptEntry[] {
  return transcript
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\]\s+([^:]+):\s*(.*)$/);
      if (!match) return null;
      const timestamp = new Date(match[1]);
      if (Number.isNaN(timestamp.getTime())) return null;
      return {
        timestamp,
        author: match[2].trim(),
        content: match[3].trim(),
        isBot: match[2].includes("[bot]"),
      } satisfies TranscriptEntry;
    })
    .filter((entry): entry is TranscriptEntry => entry !== null);
}

function formatDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

function formatUtcTag(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}-${String(date.getUTCHours()).padStart(2, "0")}-${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

function toDiscordTimestampTag(date: Date, style: string = "S"): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const tzName = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value;

  const match = tzName?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * ((Number(match[2]) * 60) + Number(match[3])) * 60 * 1000;
}

function createDateFromTimeZoneParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const approxUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
  const offset = getTimeZoneOffsetMs(approxUtc, timeZone);
  return new Date(approxUtc.getTime() - offset);
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

function addDaysToLocalDate(year: number, month: number, day: number, delta: number) {
  const base = new Date(Date.UTC(year, month - 1, day + delta, 12, 0, 0, 0));
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
}

function parseLocalDateTimeTag(value: string): { year: number; month: number; day: number; hour: number; minute: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/);
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

function extractQuotedTerms(text: string): string[] {
  const matches = [...text.matchAll(/["“”']([^"“”']{2,40})["“”']/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  return [...new Set(matches)];
}

function applyDiscordTimestampMarkup(text: string): string {
  return text.replace(/\[\[ts:([^\]|]+)(?:\|([A-Za-z]))?\]\]/g, (_full, rawValue: string, rawStyle?: string) => {
    const style = rawStyle ?? "S";
    const trimmed = rawValue.trim();
    let date: Date | null = null;

    if (/^\d{10}$/.test(trimmed)) {
      date = new Date(Number(trimmed) * 1000);
    } else {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) date = parsed;
    }

    if (!date) return trimmed;
    return toDiscordTimestampTag(date, style);
  });
}

function postProcessQuestionResult(result: QuestionResult): QuestionResult {
  return {
    ...result,
    questions: result.questions.map((question) => applyDiscordTimestampMarkup(question)),
  };
}

function postProcessSummaryResult(result: SummaryResult): SummaryResult {
  return {
    ...result,
    reason: applyDiscordTimestampMarkup(result.reason),
    summary: applyDiscordTimestampMarkup(result.summary),
  };
}

function buildSummaryInputContext(input: ReportAnalysisInput): string[] {
  const entries = parseTranscriptEntries(input.transcript);
  const reporterEntries = entries.filter((entry) => !entry.isBot);
  const firstReporterEntry = reporterEntries[0] ?? null;
  const firstTimestamp = entries[0]?.timestamp ?? null;
  const lines: string[] = [];

  if (firstReporterEntry) {
    lines.push(`Signalement initial: ${firstReporterEntry.content}`);
    const quotedTerms = extractQuotedTerms(firstReporterEntry.content);
    if (quotedTerms.length > 0) {
      lines.push(`Termes cites dans le signalement: ${quotedTerms.join(", ")}`);
    }
  }

  if (!firstTimestamp || !firstReporterEntry) return lines;

  const local = formatDateParts(firstTimestamp, SOURCE_REPORT_TIMEZONE);
  lines.push(`Ancrage temporel du ticket (UTC): ${firstTimestamp.toISOString()}`);
  lines.push(`Repere Discord du ticket: ${toDiscordTimestampTag(firstTimestamp)}`);

  if (/\bhier\b/i.test(firstReporterEntry.content)) {
    const previousLocalDay = addDaysToLocalDate(local.year, local.month, local.day, -1);
    const approxTime = firstReporterEntry.content.match(/\bvers\s+(\d{1,2})[:h](\d{2})\b/i);

    if (approxTime) {
      const hour = Number(approxTime[1]);
      const minute = Number(approxTime[2]);
      const startMinute = Math.max(0, minute - 10);
      const endMinute = Math.min(59, minute + 10);
      const start = createDateFromTimeZoneParts(previousLocalDay.year, previousLocalDay.month, previousLocalDay.day, hour, startMinute, 0, SOURCE_REPORT_TIMEZONE);
      const end = createDateFromTimeZoneParts(previousLocalDay.year, previousLocalDay.month, previousLocalDay.day, hour, endMinute, 59, SOURCE_REPORT_TIMEZONE);
      lines.push(`Fenetre probable des faits (UTC): ${start.toISOString()} -> ${end.toISOString()}`);
      lines.push(`Fenetre historyQuery recommandee (UTC): startAt=${formatUtcTag(start)} endAt=${formatUtcTag(end)}`);
      lines.push(`Reperes Discord recommandes: ${toDiscordTimestampTag(start)} -> ${toDiscordTimestampTag(end)}`);
    } else {
      const start = createDateFromTimeZoneParts(previousLocalDay.year, previousLocalDay.month, previousLocalDay.day, 0, 0, 0, SOURCE_REPORT_TIMEZONE);
      const end = createDateFromTimeZoneParts(previousLocalDay.year, previousLocalDay.month, previousLocalDay.day, 23, 59, 59, SOURCE_REPORT_TIMEZONE);
      lines.push(`Jour probable des faits (UTC): ${start.toISOString()} -> ${end.toISOString()}`);
      lines.push(`Fenetre historyQuery recommandee (UTC): startAt=${formatUtcTag(start)} endAt=${formatUtcTag(end)}`);
      lines.push(`Reperes Discord recommandes: ${toDiscordTimestampTag(start)} -> ${toDiscordTimestampTag(end)}`);
    }
  }

  return lines;
}

async function fetchHistoryToolResult(guildID: string, q: HistoryQuery): Promise<string> {
  const normalizedQuery = normalizeHistoryQuery(q);
  const resolvedWindow = resolveHistoryWindow(normalizedQuery);

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
    const line = `[${new Date(message.createdAt).toISOString()}] #${message.channelID} ${message.authorUsername}: ${message.content}${suffix}`;
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

async function fetchSanctionsToolResult(guildID: string, q: SanctionsQuery): Promise<string> {
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
    .sort((a, b) => b.createdAt - a.createdAt)
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

async function fetchChannelsToolResult(guildID: string, q: ChannelsQuery): Promise<string> {
  const channels = await channelMetaService.listByGuild(guildID);
  const query = q.nameQuery?.trim().toLowerCase() ?? "";
  const filtered = query
    ? channels.filter((channel) =>
        channel.channelName.toLowerCase().includes(query) ||
        (channel.parentName?.toLowerCase().includes(query) ?? false),
      )
    : channels;

  const limited = filtered.slice(0, Math.max(1, Math.min(q.limit, 100)));

  console.log("[ai] guildChannels args", q);
  console.log("[ai] guildChannels raw result", limited);

  if (limited.length === 0) {
    return `[Outil: Salons du serveur — args: ${JSON.stringify(q)}, 0 salons]\nAucun salon trouve.`;
  }

  const formatted = limited
    .map((channel) => `- ${channel.channelName} | id=${channel.channelID} | parent=${channel.parentName ?? "aucun"}`)
    .join("\n");

  return `[Outil: Salons du serveur — args: ${JSON.stringify(q)}, ${limited.length} salons]\n${formatted}`;
}

function createModerationTools(guildID: string) {
  const historyTool = tool(
    (query: HistoryQuery) => fetchHistoryToolResult(guildID, query),
    {
      name: "historyQuery",
      description: "Consulte l'historique des messages d'un utilisateur dans la base de donnees du serveur. Privilegie des recherches larges: variantes orthographiques, mots racines, plusieurs termes, et mode 'any' pour ne pas rater des messages pertinents.",
      schema: z.object({
        userID: z.string().describe("ID Discord de l'utilisateur a inspecter"),
        startAt: z.string().nullable().describe("Borne UTC de debut au format YYYY-MM-DD-HH-mm"),
        endAt: z.string().nullable().describe("Borne UTC de fin au format YYYY-MM-DD-HH-mm"),
        onlyDeleted: z.boolean().describe("true si seuls les messages supprimes doivent etre recuperes"),
        channelID: z.string().nullable().describe("ID du salon a restreindre, ou null pour tous"),
        search: z.string().nullable().describe("Recherche libre. L'application la decoupe et l'assouplit si besoin."),
        searchTerms: z.array(z.string()).nullable().describe("Liste de termes ou variantes orthographiques a rechercher"),
        searchMode: z.enum(["any", "all"]).nullable().describe("'any' pour un filtrage large, 'all' pour exiger tous les termes"),
        limit: z.number().int().min(1).max(100).describe("Nombre de messages a recuperer"),
      }),
    },
  );

  const searchTool = tool(
    async ({ query }: { query: string }) => {
      const result = await duckduckgoTool.invoke(query);
      return typeof result === "string" ? result : JSON.stringify(result);
    },
    {
      name: "searchQuery",
      description: "Lance une recherche DuckDuckGo pour verifier des faits externes ou du jargon ambigu.",
      schema: z.object({
        query: z.string().describe("Requete de recherche en francais"),
      }),
    },
  );

  const sanctionsTool = tool(
    (query: SanctionsQuery) => fetchSanctionsToolResult(guildID, query),
    {
      name: "userSanctions",
      description: "Recupere uniquement les sanctions actives d'un utilisateur. Utilise cet outil pour verifier une recidive ou eviter de redemander une information deja disponible.",
      schema: z.object({
        userID: z.string().describe("ID Discord de l'utilisateur a inspecter"),
        limit: z.number().int().min(1).max(50).describe("Nombre maximum de sanctions a renvoyer"),
      }),
    },
  );

  const channelsTool = tool(
    (query: ChannelsQuery) => fetchChannelsToolResult(guildID, query),
    {
      name: "guildChannels",
      description: "Liste les salons actuels du serveur directement depuis l'API Discord, avec leur nom et leur identifiant. Utilise cet outil pour retrouver des noms de salons sans demander d'ID a l'utilisateur.",
      schema: z.object({
        nameQuery: z.string().nullable().describe("Fragment de nom de salon pour filtrer, ou null pour lister largement"),
        limit: z.number().int().min(1).max(100).describe("Nombre maximum de salons a renvoyer"),
      }),
    },
  );

  return [historyTool, searchTool, sanctionsTool, channelsTool];
}

function finalizeSchemaOutput<T extends Record<string, unknown>>(value: T): T {
  const output = { ...value } as Record<string, unknown>;
  if ("historyQuery" in output) output["historyQuery"] = null;
  if ("searchQuery" in output) output["searchQuery"] = null;
  return output as T;
}

async function invokeStructuredWithFallback<T>(
  messages: BaseMessage[],
  schema: StructuredSchema<T>,
): Promise<T> {
  logMessages(`→ structured invoke (${messages.length} messages)`, messages);

  let lastError: unknown;
  for (const [index, llm] of getCandidateLLMs().entries()) {
    try {
      const raw = await llm.withStructuredOutput(schema as z.ZodType).invoke(messages);
      const normalized = normalizeStructuredPayload(raw);
      console.log(`[ai] ← structured result${index === 0 ? "" : " (fallback)"}: ${JSON.stringify(normalized).slice(0, 300)}`);
      return schema.parse(normalized);
    } catch (error) {
      lastError = error;
      console.warn(`[ai] structured invoke failed on model #${index + 1}`, error);
    }
  }

  throw lastError;
}

async function runWithTools<T extends Record<string, unknown>>(
  initialMessages: BaseMessage[],
  schema: StructuredSchema<T>,
  guildID: string,
): Promise<T> {
  const tools = createModerationTools(guildID);
  let lastError: unknown;

  for (const [index, llm] of getCandidateLLMs().entries()) {
    try {
      const llmWithTools = llm.bindTools(tools);
      let messages = [...initialMessages];

      logMessages(`→ invoke with tools (${messages.length} messages)`, messages);

      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const response = await llmWithTools.invoke(messages) as AIMessage;
        messages = [...messages, response];

        const toolCalls = response.tool_calls ?? [];
        console.log(`[ai] ← tool calls${index === 0 ? "" : " (fallback)"}: ${toolCalls.map((call) => call.name).join(", ") || "(aucun)"}`);

        if (toolCalls.length === 0) {
          const finalResult = await invokeStructuredWithFallback(messages, schema);
          return finalizeSchemaOutput(finalResult);
        }

        for (const call of toolCalls) {
          console.log("[ai] tool call", {
            name: call.name,
            args: call.args,
            id: call.id,
          });

          let result: string;
          try {
            if (call.name === "historyQuery") {
              result = await fetchHistoryToolResult(guildID, call.args as HistoryQuery);
            } else if (call.name === "searchQuery") {
              const search = await duckduckgoTool.invoke((call.args as { query: string }).query);
              result = typeof search === "string" ? search : JSON.stringify(search);
            } else if (call.name === "userSanctions") {
              result = await fetchSanctionsToolResult(guildID, call.args as SanctionsQuery);
            } else if (call.name === "guildChannels") {
              result = await fetchChannelsToolResult(guildID, call.args as ChannelsQuery);
            } else {
              result = `Outil inconnu: ${call.name}`;
            }
          } catch (error) {
            result = `Erreur lors de l'execution de l'outil ${call.name}: ${error instanceof Error ? error.message : String(error)}`;
          }

          console.log(`[ai] ← tool result ${call.name} (${result.length} chars)`, result);
          messages = [...messages, new ToolMessage({ content: result, tool_call_id: call.id ?? call.name })];
        }
      }

      const finalResult = await invokeStructuredWithFallback(messages, schema);
      return finalizeSchemaOutput(finalResult);
    } catch (error) {
      lastError = error;
      console.warn(`[ai] tool loop failed on model #${index + 1}`, error);
    }
  }

  throw lastError;
}

export async function analyzeFlag(input: FlagAnalysisInput): Promise<FlagAnalysisResult> {
  const contextText = input.contextMessages
    .map((message) => {
      const base = `[${new Date(message.createdAt).toISOString()}] ${message.authorUsername} (${message.authorID}): ${message.content}`;
      const images = message.attachments?.map((attachment) => `[image: ${attachment.url}]`).join(" ") ?? "";
      return images ? `${base} ${images}` : base;
    })
    .join("\n");

  const messages: BaseMessage[] = [
    new SystemMessage({ content: flagSystemPrompt, additional_kwargs: { cache_control: { type: "ephemeral" } } }),
    new HumanMessage(
      [
        `Reporter ID: ${input.reporterID}`,
        `Reporter username: ${input.reporterUsername ?? "(unknown)"}`,
        `Reporter display name: ${input.reporterDisplayName ?? "(unknown)"}`,
        `Reported message author ID: ${input.targetUserID}`,
        `Reported message author username: ${input.targetUsername ?? "(unknown)"}`,
        `Reported message author display name: ${input.targetDisplayName ?? "(unknown)"}`,
        `Sanctions precedentes pertinentes: ${JSON.stringify(input.priorSanctions ?? [])}`,
        `Mentions detectees: ${JSON.stringify(input.messageMentions ?? [])}`,
        `Message cible: ${input.messageContent}`,
        "Contexte:",
        contextText || "(vide)",
      ].join("\n"),
    ),
  ];

  try {
    return await runWithTools(messages, FlagAnalysisSchema, input.guildID);
  } catch (error) {
    console.error("[ai] analyzeFlag failed", {
      reporterID: input.reporterID,
      targetUserID: input.targetUserID,
      messageContent: input.messageContent,
      error,
    });

    return {
      isViolation: false,
      severity: "LOW",
      sanctionKind: "WARN",
      reason: "L'analyse IA du signalement a echoue. Le cas doit etre revu via le flux de ticket.",
      nature: "Harassment",
      similarSanctionIDs: [],
      targetID: null,
      needsMoreContext: true,
      searchQuery: null,
      historyQuery: null,
    };
  }
}

export async function askReportQuestions(input: ReportAnalysisInput): Promise<QuestionResult> {
  const derivedContext = buildSummaryInputContext(input);

  const messages: BaseMessage[] = [
    new SystemMessage(questionSystemPrompt),
    new HumanMessage(
      [
        `Reporter ID: ${input.reporterID}`,
        `Target ID: ${input.targetUserID}`,
        `Sanctions precedentes pertinentes: ${JSON.stringify(input.priorSanctions ?? [])}`,
        ...(derivedContext.length > 0 ? ["Contexte derive:", ...derivedContext] : []),
        "Contenu du dossier:",
        input.transcript,
      ].join("\n"),
    ),
  ];

  try {
    return postProcessQuestionResult(await runWithTools(messages, QuestionSchema, input.guildID));
  } catch (error) {
    console.error("[ai] askReportQuestions failed, using fallback", error);
    return {
      needsFollowUp: true,
      questions: [
        "Decris precisement le comportement reproche avec les mots exacts ou actions visees.",
        "Quand cela s'est-il produit ? Donne une date et une heure approximatives.",
        "Peux-tu partager un lien vers le message Discord concerne ou une citation exacte avec son contexte ?",
      ],
    };
  }
}

export async function summarizeReport(input: ReportAnalysisInput): Promise<SummaryResult> {
  const derivedContext = buildSummaryInputContext(input);

  const messages: BaseMessage[] = [
    new SystemMessage({ content: summarySystemPrompt, additional_kwargs: { cache_control: { type: "ephemeral" } } }),
    new HumanMessage(
      [
        `Reporter ID: ${input.reporterID}`,
        `Target ID: ${input.targetUserID}`,
        `Date actuelle (UTC): ${new Date().toISOString()}`,
        `Sanctions precedentes pertinentes: ${JSON.stringify(input.priorSanctions ?? [])}`,
        ...(derivedContext.length > 0 ? ["Contexte derive:", ...derivedContext] : []),
        "Transcript complet du ticket:",
        input.transcript,
      ].join("\n"),
    ),
  ];

  try {
    return postProcessSummaryResult(await runWithTools(messages, SummarySchema, input.guildID));
  } catch (error) {
    console.error("[ai] summarizeReport failed", error);
    return {
      isViolation: false,
      severity: "LOW",
      sanctionKind: "WARN",
      reason: "Analyse IA indisponible en mode degrade.",
      nature: "Harassment",
      similarSanctionIDs: [],
      targetID: input.targetUserID,
      searchQuery: null,
      historyQuery: null,
      summary: "Analyse indisponible. Le dossier doit etre examine manuellement par un moderateur.",
    };
  }
}
