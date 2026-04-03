import type { ChannelValue, MemberOverview, StatsOverview } from "@/lib/api-stats";
import type { ChartDatum, StatsData } from "./types";

export const EMPTY_OVERVIEW: StatsOverview = {
  summary: { total: 0, uniqueUsers: 0, uniqueChannels: 0 },
  byDay: [],
  byHour: [],
  byHourTimeline: [],
};

export const EMPTY_MEMBER_OVERVIEW: MemberOverview = {
  summary: { total: 0, joined: 0, left: 0 },
  byDay: [],
  byHour: [],
  byHourTimeline: [],
};

export const EMPTY_STATS: StatsData = {
  msgOverview: EMPTY_OVERVIEW,
  msgByChannel: [],
  msgByUser: [],
  voiceOverview: EMPTY_OVERVIEW,
  voiceByChannel: [],
  voiceByUser: [],
  memberOverview: EMPTY_MEMBER_OVERVIEW,
};

export const CHART_COLORS = [
  "#5865f2",
  "#ed4245",
  "#faa61a",
  "#23a55a",
  "#00a8fc",
  "#eb459e",
  "#57f287",
  "#fee75c",
  "#9b59b6",
  "#1abc9c",
];

export const SERIES_COLORS = {
  total: "#38d26b",
  users: "#8d6bff",
  channels: "#ff4f9a",
};

export const MEMBER_SERIES_COLORS = {
  total: "#5865f2",
  joined: "#23a55a",
  left: "#ed4245",
};

export const PRESETS = [
  { label: "7 jours", days: 7 },
  { label: "30 jours", days: 30 },
  { label: "90 jours", days: 90 },
] as const;

const CHILD_TYPES = new Set([11, 12]);

export function groupChannelData(channels: ChannelValue[]): ChartDatum[] {
  const grouped = new Map<string, number>();

  for (const channel of channels) {
    const isChild =
      (channel.channelType != null && CHILD_TYPES.has(channel.channelType)) ||
      (channel.parentID != null && channel.channelType != null && CHILD_TYPES.has(channel.channelType));
    const useParent = isChild && channel.parentID != null && channel.parentName;
    const key = useParent ? (channel.parentName ?? channel.channelName ?? channel.channelID) : (channel.channelName ?? channel.channelID);
    grouped.set(key, (grouped.get(key) ?? 0) + channel.value);
  }

  const sorted = [...grouped.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  if (sorted.length <= 10) return sorted;

  const top = sorted.slice(0, 9);
  const others = sorted.slice(9).reduce((sum, entry) => sum + entry.value, 0);
  return [...top, { name: "Autres", value: others }];
}

export function fmtSecs(value: number): string {
  if (value < 60) return `${value}s`;
  if (value < 3600) return `${Math.floor(value / 60)}m`;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function fmtCompactCount(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

export function fmtHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}h`;
}

export function fmtDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

export function fmtDatetime(datetime: string): string {
  const [datePart, hourPart] = datetime.split(" ");
  const [, month, day] = datePart.split("-");
  return `${day}/${month} ${hourPart}h`;
}
