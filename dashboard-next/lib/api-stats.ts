const BASE = process.env["NEXT_PUBLIC_API_BASE_URL"] ?? "";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export interface DailyValue { date: string; value: number; }
export interface HourlyValue { hour: number; value: number; }
export interface HourlyTimelineValue { datetime: string; value: number; }
export interface ChannelValue { channelID: string; value: number; }
export interface UserValue {
  userID: string;
  value: number;
  username?: string;
  displayName?: string;
  avatarURL?: string;
}

function range(guildID: string, startDate: number, endDate: number) {
  return `?startDate=${startDate}&endDate=${endDate}`;
}

export function fetchMessagesByDay(guildID: string, start: number, end: number) {
  return get<DailyValue[]>(`/api/guilds/${guildID}/stats/messages/by-day${range(guildID, start, end)}`);
}
export function fetchMessagesByHour(guildID: string, start: number, end: number) {
  return get<HourlyValue[]>(`/api/guilds/${guildID}/stats/messages/by-hour${range(guildID, start, end)}`);
}
export function fetchMessagesByChannel(guildID: string, start: number, end: number) {
  return get<ChannelValue[]>(`/api/guilds/${guildID}/stats/messages/by-channel${range(guildID, start, end)}`);
}
export function fetchMessagesByUser(guildID: string, start: number, end: number) {
  return get<UserValue[]>(`/api/guilds/${guildID}/stats/messages/by-user${range(guildID, start, end)}`);
}
export function fetchVoiceByDay(guildID: string, start: number, end: number) {
  return get<DailyValue[]>(`/api/guilds/${guildID}/stats/voice/by-day${range(guildID, start, end)}`);
}
export function fetchVoiceByHour(guildID: string, start: number, end: number) {
  return get<HourlyValue[]>(`/api/guilds/${guildID}/stats/voice/by-hour${range(guildID, start, end)}`);
}
export function fetchVoiceByChannel(guildID: string, start: number, end: number) {
  return get<ChannelValue[]>(`/api/guilds/${guildID}/stats/voice/by-channel${range(guildID, start, end)}`);
}
export function fetchVoiceByUser(guildID: string, start: number, end: number) {
  return get<UserValue[]>(`/api/guilds/${guildID}/stats/voice/by-user${range(guildID, start, end)}`);
}
export function fetchMessagesByHourTimeline(guildID: string, start: number, end: number) {
  return get<HourlyTimelineValue[]>(`/api/guilds/${guildID}/stats/messages/by-hour-timeline${range(guildID, start, end)}`);
}
export function fetchVoiceByHourTimeline(guildID: string, start: number, end: number) {
  return get<HourlyTimelineValue[]>(`/api/guilds/${guildID}/stats/voice/by-hour-timeline${range(guildID, start, end)}`);
}
