import { getJson } from "./http";

export interface DailyValue { date: string; value: number; }
export interface HourlyValue { hour: number; value: number; }
export interface HourlyTimelineValue { datetime: string; value: number; }
export interface OverviewSummary { total: number; uniqueUsers: number; uniqueChannels: number; }
export interface DailyOverviewValue extends OverviewSummary { date: string; }
export interface HourlyOverviewValue extends OverviewSummary { hour: number; }
export interface HourlyTimelineOverviewValue extends OverviewSummary { datetime: string; }
export interface StatsOverview {
  summary: OverviewSummary;
  byDay: DailyOverviewValue[];
  byHour: HourlyOverviewValue[];
  byHourTimeline: HourlyTimelineOverviewValue[];
}
export interface ChannelValue { channelID: string; value: number; channelName?: string; parentID?: string | null; parentName?: string | null; channelType?: number | null; }
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
export function fetchMessagesOverview(guildID: string, start: number, end: number) {
  return getJson<StatsOverview>(`/api/guilds/${guildID}/stats/messages/overview${range(start, end)}`);
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
export function fetchVoiceOverview(guildID: string, start: number, end: number) {
  return getJson<StatsOverview>(`/api/guilds/${guildID}/stats/voice/overview${range(start, end)}`);
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

export interface MemberOverviewSummary { total: number; joined: number; left: number; }
export interface MemberDailyValue { date: string; total: number; joined: number; left: number; }
export interface MemberHourlyValue { hour: number; joined: number; left: number; }
export interface MemberHourlyTimelineValue { datetime: string; total: number; joined: number; left: number; }
export interface MemberOverview {
  summary: MemberOverviewSummary;
  byDay: MemberDailyValue[];
  byHour: MemberHourlyValue[];
  byHourTimeline: MemberHourlyTimelineValue[];
}

export function fetchMembersOverview(guildID: string, start: number, end: number) {
  return getJson<MemberOverview>(`/api/guilds/${guildID}/stats/members/overview${range(start, end)}`);
}
