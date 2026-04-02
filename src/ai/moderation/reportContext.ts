import type { ReportAnalysisInput, SummaryResult } from "./types";

const DEFAULT_SOURCE_REPORT_TIMEZONE = "Europe/Paris";
const SOURCE_REPORT_TIMEZONE = resolveSourceReportTimezone();

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
      const match = new RegExp(/^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\]\s+([^:]+):\s*(.*)$/).exec(line);
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

function addDaysToLocalDate(year: number, month: number, day: number, delta: number) {
  const base = new Date(Date.UTC(year, month - 1, day + delta, 12, 0, 0, 0));
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
}

function extractQuotedTerms(text: string): string[] {
  const matches = [...text.matchAll(/["“”']([^"“”']{2,40})["“”']/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  return [...new Set(matches)];
}

function applyDiscordTimestampMarkup(text: string): string {
  return text.replaceAll(/\[\[ts:([^\]|]+)(?:\|([A-Za-z]))?\]\]/g, (_full, rawValue: string, style = "S") => {
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

function applyDiscordChannelMarkup(text: string): string {
  return text.replaceAll(/(^|[\s(,])#(\d{17,20})(?=$|[\s),.])/g, (_full, prefix: string, channelID: string) => {
    return `${prefix}<#${channelID}>`;
  });
}

function applyDiscordOutputMarkup(text: string): string {
  return applyDiscordChannelMarkup(applyDiscordTimestampMarkup(text));
}

function resolveSourceReportTimezone(): string {
  const configuredTimeZone = process.env["SOURCE_REPORT_TIMEZONE"]?.trim();
  if (!configuredTimeZone) return DEFAULT_SOURCE_REPORT_TIMEZONE;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: configuredTimeZone }).format(new Date());
    return configuredTimeZone;
  } catch {
    return DEFAULT_SOURCE_REPORT_TIMEZONE;
  }
}

function mentionsYesterday(text: string): boolean {
  return /(?<!avant[-\s])\bhier\b/i.test(text);
}

export function getSourceReportTimezone(): string {
  return SOURCE_REPORT_TIMEZONE;
}

export function postProcessSummaryResult(result: SummaryResult): SummaryResult {
  return {
    ...result,
    reason: applyDiscordOutputMarkup(result.reason),
    summary: applyDiscordOutputMarkup(result.summary),
    questions: result.questions.map((question) => applyDiscordOutputMarkup(question)),
  };
}

export function buildSummaryInputContext(input: ReportAnalysisInput): string[] {
  const entries = parseTranscriptEntries(input.transcript);
  const reporterEntry = entries.find((entry) => !entry.isBot);
  const firstReporterEntry = reporterEntry ?? null;
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
  lines.push(
    `Les utilisateurs parlent souvent avec des reperes horaires en SOURCE_REPORT_TIMEZONE=${SOURCE_REPORT_TIMEZONE}.`,
    `Ancrage temporel du ticket (UTC): ${firstTimestamp.toISOString()}`
  );

  if (mentionsYesterday(firstReporterEntry.content)) {
    const previousLocalDay = addDaysToLocalDate(local.year, local.month, local.day, -1);
    const approxTime = new RegExp(/\bvers\s+(\d{1,2})[:h](\d{2})\b/i).exec(firstReporterEntry.content);

    if (approxTime) {
      const hour = Number(approxTime[1]);
      const minute = Number(approxTime[2]);
      const startMinute = Math.max(0, minute - 10);
      const endMinute = Math.min(59, minute + 10);
      const start = createDateFromTimeZoneParts(previousLocalDay.year, previousLocalDay.month, previousLocalDay.day, hour, startMinute, 0, SOURCE_REPORT_TIMEZONE);
      const end = createDateFromTimeZoneParts(previousLocalDay.year, previousLocalDay.month, previousLocalDay.day, hour, endMinute, 59, SOURCE_REPORT_TIMEZONE);
      lines.push(
        `Fenetre probable des faits (UTC): ${start.toISOString()} -> ${end.toISOString()}`
      );
    } else {
      const start = createDateFromTimeZoneParts(previousLocalDay.year, previousLocalDay.month, previousLocalDay.day, 0, 0, 0, SOURCE_REPORT_TIMEZONE);
      const end = createDateFromTimeZoneParts(previousLocalDay.year, previousLocalDay.month, previousLocalDay.day, 23, 59, 59, SOURCE_REPORT_TIMEZONE);
      lines.push(
        `Jour probable des faits (UTC): ${start.toISOString()} -> ${end.toISOString()}`
      );
    }
  }

  return lines;
}
