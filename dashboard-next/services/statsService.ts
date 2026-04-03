import { Op, QueryTypes } from "sequelize";
import { sequelize } from "../lib/db";
import { MessageHistory } from "../models/MessageHistory";
import { VoiceSession } from "../models/VoiceSession";

export interface UserMeta {
  userID: string;
  username: string;
  displayName: string;
  avatarURL: string;
}

export interface DailyValue {
  date: string;
  value: number;
}

export interface HourlyValue {
  hour: number;
  value: number;
}

export interface ChannelValue {
  channelID: string;
  value: number;
}

export interface UserValue {
  userID: string;
  value: number;
}

export interface HourlyTimelineValue {
  datetime: string;
  value: number;
}

export interface OverviewSummary {
  total: number;
  uniqueUsers: number;
  uniqueChannels: number;
}

export interface DailyOverviewValue extends OverviewSummary {
  date: string;
}

export interface HourlyOverviewValue extends OverviewSummary {
  hour: number;
}

export interface HourlyTimelineOverviewValue extends OverviewSummary {
  datetime: string;
}

export interface StatsOverview {
  summary: OverviewSummary;
  byDay: DailyOverviewValue[];
  byHour: HourlyOverviewValue[];
  byHourTimeline: HourlyTimelineOverviewValue[];
}

type BucketAccumulator = {
  total: number;
  uniqueUsers: Set<string>;
  uniqueChannels: Set<string>;
};

function createBucket(): BucketAccumulator {
  return {
    total: 0,
    uniqueUsers: new Set<string>(),
    uniqueChannels: new Set<string>(),
  };
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function hourTimelineKey(date: Date): string {
  return `${dayKey(date)} ${String(date.getHours()).padStart(2, "0")}`;
}

function mapBucketToSummary(bucket?: BucketAccumulator): OverviewSummary {
  return {
    total: Math.round(bucket?.total ?? 0),
    uniqueUsers: bucket?.uniqueUsers.size ?? 0,
    uniqueChannels: bucket?.uniqueChannels.size ?? 0,
  };
}

function buildDaySeries(startDate: number, endDate: number, map: Map<string, BucketAccumulator>): DailyOverviewValue[] {
  const result: DailyOverviewValue[] = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= endDate) {
    const date = dayKey(cursor);
    result.push({ date, ...mapBucketToSummary(map.get(date)) });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

function buildHourSeries(map: Map<number, BucketAccumulator>): HourlyOverviewValue[] {
  const result: HourlyOverviewValue[] = [];
  for (let hour = 0; hour < 24; hour++) {
    result.push({ hour, ...mapBucketToSummary(map.get(hour)) });
  }
  return result;
}

function buildHourTimelineSeries(
  startDate: number,
  endDate: number,
  map: Map<string, BucketAccumulator>,
): HourlyTimelineOverviewValue[] {
  const result: HourlyTimelineOverviewValue[] = [];
  const cursor = new Date(startDate);
  cursor.setMinutes(0, 0, 0);

  while (cursor.getTime() <= endDate) {
    const datetime = hourTimelineKey(cursor);
    result.push({ datetime, ...mapBucketToSummary(map.get(datetime)) });
    cursor.setHours(cursor.getHours() + 1);
  }

  return result;
}

function clamp(session: { start: number; end: number }, start: number, end: number) {
  return Math.max(0, Math.min(session.end, end) - Math.max(session.start, start));
}

export async function getUserMetas(userIDs: string[]): Promise<Map<string, UserMeta>> {
  if (userIDs.length === 0) return new Map();
  const placeholders = userIDs.map(() => "?").join(", ");
  const rows = await sequelize.query<{
    authorID: string;
    authorUsername: string;
    authorDisplayName: string;
    authorAvatarURL: string;
  }>(
    `SELECT ms.authorID, ms.authorUsername, ms.authorDisplayName, ms.authorAvatarURL
     FROM MessageSnapshots ms
     INNER JOIN (
       SELECT authorID, MAX(snapshotAt) AS maxSnap
       FROM MessageSnapshots
       WHERE authorID IN (${placeholders})
       GROUP BY authorID
     ) latest ON ms.authorID = latest.authorID AND ms.snapshotAt = latest.maxSnap
     WHERE ms.authorID IN (${placeholders})`,
    { replacements: [...userIDs, ...userIDs], type: QueryTypes.SELECT },
  );
  const map = new Map<string, UserMeta>();
  for (const r of rows) {
    if (!map.has(r.authorID)) {
      map.set(r.authorID, {
        userID: r.authorID,
        username: r.authorUsername,
        displayName: r.authorDisplayName,
        avatarURL: r.authorAvatarURL,
      });
    }
  }
  return map;
}

export async function getMessageStatsByDay(
  guildID: string,
  startDate: number,
  endDate: number,
): Promise<DailyValue[]> {
  const overview = await getMessageStatsOverview(guildID, startDate, endDate);
  return overview.byDay.map(({ date, total }) => ({ date, value: total }));
}

export async function getMessageStatsByHour(
  guildID: string,
  startDate: number,
  endDate: number,
): Promise<HourlyValue[]> {
  const overview = await getMessageStatsOverview(guildID, startDate, endDate);
  return overview.byHour.map(({ hour, total }) => ({ hour, value: total }));
}

export async function getMessageStatsByChannel(
  guildID: string,
  startDate: number,
  endDate: number,
): Promise<ChannelValue[]> {
  const rows = await MessageHistory.findAll({
    attributes: ["channelID"],
    where: { guildID, date: { [Op.between]: [startDate, endDate] } },
  });

  const map = new Map<string, number>();
  for (const r of rows as any[]) {
    map.set(r.channelID, (map.get(r.channelID) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([channelID, value]) => ({ channelID, value }))
    .sort((a, b) => b.value - a.value);
}

export async function getMessageStatsByUser(
  guildID: string,
  startDate: number,
  endDate: number,
): Promise<UserValue[]> {
  const rows = await MessageHistory.findAll({
    attributes: ["userID"],
    where: { guildID, date: { [Op.between]: [startDate, endDate] } },
  });

  const map = new Map<string, number>();
  for (const r of rows as any[]) {
    map.set(r.userID, (map.get(r.userID) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([userID, value]) => ({ userID, value }))
    .sort((a, b) => b.value - a.value);
}

export async function getMessageStatsByHourTimeline(
  guildID: string,
  startDate: number,
  endDate: number,
): Promise<HourlyTimelineValue[]> {
  const overview = await getMessageStatsOverview(guildID, startDate, endDate);
  return overview.byHourTimeline.map(({ datetime, total }) => ({ datetime, value: total }));
}

export async function getMessageStatsOverview(
  guildID: string,
  startDate: number,
  endDate: number,
): Promise<StatsOverview> {
  const rows = await MessageHistory.findAll({
    attributes: ["date", "userID", "channelID"],
    where: { guildID, date: { [Op.between]: [startDate, endDate] } },
  });

  const summaryUsers = new Set<string>();
  const summaryChannels = new Set<string>();
  const byDay = new Map<string, BucketAccumulator>();
  const byHour = new Map<number, BucketAccumulator>();
  const byHourTimeline = new Map<string, BucketAccumulator>();

  for (const r of rows as any[]) {
    const userID = String(r.userID);
    const channelID = String(r.channelID);
    const date = new Date(Number(r.date));
    const day = dayKey(date);
    const hour = date.getHours();
    const timeline = hourTimelineKey(date);

    summaryUsers.add(userID);
    summaryChannels.add(channelID);

    const dayBucket = byDay.get(day) ?? createBucket();
    dayBucket.total += 1;
    dayBucket.uniqueUsers.add(userID);
    dayBucket.uniqueChannels.add(channelID);
    byDay.set(day, dayBucket);

    const hourBucket = byHour.get(hour) ?? createBucket();
    hourBucket.total += 1;
    hourBucket.uniqueUsers.add(userID);
    hourBucket.uniqueChannels.add(channelID);
    byHour.set(hour, hourBucket);

    const timelineBucket = byHourTimeline.get(timeline) ?? createBucket();
    timelineBucket.total += 1;
    timelineBucket.uniqueUsers.add(userID);
    timelineBucket.uniqueChannels.add(channelID);
    byHourTimeline.set(timeline, timelineBucket);
  }

  return {
    summary: {
      total: rows.length,
      uniqueUsers: summaryUsers.size,
      uniqueChannels: summaryChannels.size,
    },
    byDay: buildDaySeries(startDate, endDate, byDay),
    byHour: buildHourSeries(byHour),
    byHourTimeline: buildHourTimelineSeries(startDate, endDate, byHourTimeline),
  };
}

export async function getVoiceStatsByDay(
  guildID: string,
  startDate: number,
  endDate: number,
): Promise<DailyValue[]> {
  const overview = await getVoiceStatsOverview(guildID, startDate, endDate);
  return overview.byDay.map(({ date, total }) => ({ date, value: total }));
}

export async function getVoiceStatsByHour(
  guildID: string,
  startDate: number,
  endDate: number,
): Promise<HourlyValue[]> {
  const overview = await getVoiceStatsOverview(guildID, startDate, endDate);
  return overview.byHour.map(({ hour, total }) => ({ hour, value: total }));
}

export async function getVoiceStatsByChannel(
  guildID: string,
  startDate: number,
  endDate: number,
): Promise<ChannelValue[]> {
  const rows = await VoiceSession.findAll({
    attributes: ["channelID", "start", "end"],
    where: {
      guildID,
      [Op.and]: [{ start: { [Op.lte]: endDate } }, { end: { [Op.gte]: startDate } }],
    },
  });

  const map = new Map<string, number>();
  for (const r of rows as any[]) {
    const secs = clamp({ start: Number(r.start), end: Number(r.end) }, startDate, endDate) / 1000;
    map.set(r.channelID, (map.get(r.channelID) ?? 0) + secs);
  }

  return Array.from(map.entries())
    .map(([channelID, value]) => ({ channelID, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);
}

export async function getVoiceStatsByHourTimeline(
  guildID: string,
  startDate: number,
  endDate: number,
): Promise<HourlyTimelineValue[]> {
  const overview = await getVoiceStatsOverview(guildID, startDate, endDate);
  return overview.byHourTimeline.map(({ datetime, total }) => ({ datetime, value: total }));
}

export async function getVoiceStatsByUser(
  guildID: string,
  startDate: number,
  endDate: number,
): Promise<UserValue[]> {
  const rows = await VoiceSession.findAll({
    attributes: ["userID", "start", "end"],
    where: {
      guildID,
      [Op.and]: [{ start: { [Op.lte]: endDate } }, { end: { [Op.gte]: startDate } }],
    },
  });

  const map = new Map<string, number>();
  for (const r of rows as any[]) {
    const secs = clamp({ start: Number(r.start), end: Number(r.end) }, startDate, endDate) / 1000;
    map.set(r.userID, (map.get(r.userID) ?? 0) + secs);
  }

  return Array.from(map.entries())
    .map(([userID, value]) => ({ userID, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);
}

export async function getVoiceStatsOverview(
  guildID: string,
  startDate: number,
  endDate: number,
): Promise<StatsOverview> {
  const rows = await VoiceSession.findAll({
    attributes: ["userID", "channelID", "start", "end"],
    where: {
      guildID,
      [Op.and]: [{ start: { [Op.lte]: endDate } }, { end: { [Op.gte]: startDate } }],
    },
  });

  const summaryUsers = new Set<string>();
  const summaryChannels = new Set<string>();
  const byDay = new Map<string, BucketAccumulator>();
  const byHour = new Map<number, BucketAccumulator>();
  const byHourTimeline = new Map<string, BucketAccumulator>();
  let total = 0;

  for (const r of rows as any[]) {
    const userID = String(r.userID);
    const channelID = String(r.channelID);
    const session = { start: Number(r.start), end: Number(r.end) };
    const clamped = clamp(session, startDate, endDate);

    if (clamped <= 0) continue;

    summaryUsers.add(userID);
    summaryChannels.add(channelID);
    total += clamped / 1000;

    let dayCursor = new Date(Math.max(session.start, startDate));
    dayCursor.setHours(0, 0, 0, 0);

    while (dayCursor.getTime() <= Math.min(session.end, endDate)) {
      const bucketStart = dayCursor.getTime();
      const bucketEnd = bucketStart + 86400000;
      const secs = clamp(session, bucketStart, bucketEnd) / 1000;
      if (secs > 0) {
        const key = dayKey(dayCursor);
        const bucket = byDay.get(key) ?? createBucket();
        bucket.total += secs;
        bucket.uniqueUsers.add(userID);
        bucket.uniqueChannels.add(channelID);
        byDay.set(key, bucket);
      }
      dayCursor = new Date(bucketEnd);
    }

    let hourCursor = new Date(Math.max(session.start, startDate));
    hourCursor.setMinutes(0, 0, 0);

    while (hourCursor.getTime() <= Math.min(session.end, endDate)) {
      const bucketStart = hourCursor.getTime();
      const bucketEnd = bucketStart + 3600000;
      const secs = clamp(session, bucketStart, bucketEnd) / 1000;
      if (secs > 0) {
        const hour = hourCursor.getHours();
        const timeline = hourTimelineKey(hourCursor);

        const hourBucket = byHour.get(hour) ?? createBucket();
        hourBucket.total += secs;
        hourBucket.uniqueUsers.add(userID);
        hourBucket.uniqueChannels.add(channelID);
        byHour.set(hour, hourBucket);

        const timelineBucket = byHourTimeline.get(timeline) ?? createBucket();
        timelineBucket.total += secs;
        timelineBucket.uniqueUsers.add(userID);
        timelineBucket.uniqueChannels.add(channelID);
        byHourTimeline.set(timeline, timelineBucket);
      }
      hourCursor = new Date(bucketEnd);
    }
  }

  return {
    summary: {
      total: Math.round(total),
      uniqueUsers: summaryUsers.size,
      uniqueChannels: summaryChannels.size,
    },
    byDay: buildDaySeries(startDate, endDate, byDay),
    byHour: buildHourSeries(byHour),
    byHourTimeline: buildHourTimelineSeries(startDate, endDate, byHourTimeline),
  };
}
