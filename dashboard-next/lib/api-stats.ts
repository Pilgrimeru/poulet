import { getJson } from "./http";

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

function range(startDate: number, endDate: number) {
  return `?startDate=${startDate}&endDate=${endDate}`;
}

export function fetchMessagesByDay(guildID: string, start: number, end: number) {
  return getJson<DailyValue[]>(`/api/guilds/${guildID}/stats/messages/by-day${range(start, end)}`);
}
export function fetchMessagesByHour(guildID: string, start: number, end: number) {
  return getJson<HourlyValue[]>(`/api/guilds/${guildID}/stats/messages/by-hour${range(start, end)}`);
}
export function fetchMessagesByChannel(guildID: string, start: number, end: number) {
  return getJson<ChannelValue[]>(`/api/guilds/${guildID}/stats/messages/by-channel${range(start, end)}`);
}
export function fetchMessagesByUser(guildID: string, start: number, end: number) {
  return getJson<UserValue[]>(`/api/guilds/${guildID}/stats/messages/by-user${range(start, end)}`);
}
export function fetchVoiceByDay(guildID: string, start: number, end: number) {
  return getJson<DailyValue[]>(`/api/guilds/${guildID}/stats/voice/by-day${range(start, end)}`);
}
export function fetchVoiceByHour(guildID: string, start: number, end: number) {
  return getJson<HourlyValue[]>(`/api/guilds/${guildID}/stats/voice/by-hour${range(start, end)}`);
}
export function fetchVoiceByChannel(guildID: string, start: number, end: number) {
  return getJson<ChannelValue[]>(`/api/guilds/${guildID}/stats/voice/by-channel${range(start, end)}`);
}
export function fetchVoiceByUser(guildID: string, start: number, end: number) {
  return getJson<UserValue[]>(`/api/guilds/${guildID}/stats/voice/by-user${range(start, end)}`);
}
export function fetchMessagesByHourTimeline(guildID: string, start: number, end: number) {
  return getJson<HourlyTimelineValue[]>(`/api/guilds/${guildID}/stats/messages/by-hour-timeline${range(start, end)}`);
}
export function fetchVoiceByHourTimeline(guildID: string, start: number, end: number) {
  return getJson<HourlyTimelineValue[]>(`/api/guilds/${guildID}/stats/voice/by-hour-timeline${range(start, end)}`);
}
