import { Op } from "sequelize";
import { MemberEvent } from "../models/MemberEvent";

export interface MemberOverviewSummary {
  total: number;
  joined: number;
  left: number;
}

export interface MemberDailyValue {
  date: string;
  total: number;
  joined: number;
  left: number;
}

export interface MemberHourlyValue {
  hour: number;
  joined: number;
  left: number;
}

export interface MemberHourlyTimelineValue {
  datetime: string;
  total: number;
  joined: number;
  left: number;
}

export interface MemberOverview {
  summary: MemberOverviewSummary;
  byDay: MemberDailyValue[];
  byHour: MemberHourlyValue[];
  byHourTimeline: MemberHourlyTimelineValue[];
}

type MemberOverviewOptions = {
  includeHourly?: boolean;
  includeHourTimeline?: boolean;
};

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function hourTimelineKey(date: Date): string {
  return `${dayKey(date)} ${String(date.getHours()).padStart(2, "0")}`;
}

type MemberBucket = { joined: number; left: number };

function createBucket(): MemberBucket {
  return { joined: 0, left: 0 };
}

function buildDaySeries(
  startDate: number,
  endDate: number,
  map: Map<string, MemberBucket>,
  totalBeforePeriod: number,
): MemberDailyValue[] {
  const result: MemberDailyValue[] = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  let running = totalBeforePeriod;

  while (cursor.getTime() <= endDate) {
    const date = dayKey(cursor);
    const bucket = map.get(date);
    const joined = bucket?.joined ?? 0;
    const left = bucket?.left ?? 0;
    running += joined - left;
    result.push({ date, total: running, joined, left });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

function buildHourSeries(map: Map<number, MemberBucket>): MemberHourlyValue[] {
  const result: MemberHourlyValue[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const bucket = map.get(hour);
    result.push({ hour, joined: bucket?.joined ?? 0, left: bucket?.left ?? 0 });
  }
  return result;
}

function buildHourTimelineSeries(
  startDate: number,
  endDate: number,
  map: Map<string, MemberBucket>,
  totalBeforePeriod: number,
): MemberHourlyTimelineValue[] {
  const result: MemberHourlyTimelineValue[] = [];
  const cursor = new Date(startDate);
  cursor.setMinutes(0, 0, 0);
  let running = totalBeforePeriod;

  while (cursor.getTime() <= endDate) {
    const datetime = hourTimelineKey(cursor);
    const bucket = map.get(datetime);
    const joined = bucket?.joined ?? 0;
    const left = bucket?.left ?? 0;
    running += joined - left;
    result.push({ datetime, total: running, joined, left });
    cursor.setHours(cursor.getHours() + 1);
  }

  return result;
}

export async function recordMemberEvent(guildID: string, userID: string, type: "join" | "leave", date: number): Promise<void> {
  await MemberEvent.create({ guildID, userID, type, date } as any);
}

export async function bulkSeedJoins(
  events: Array<{ guildID: string; userID: string; date: number }>,
): Promise<void> {
  if (events.length === 0) return;

  // Group by guildID to query existing join userIDs per guild
  const byGuild = new Map<string, Array<{ guildID: string; userID: string; date: number }>>();
  for (const e of events) {
    const list = byGuild.get(e.guildID) ?? [];
    list.push(e);
    byGuild.set(e.guildID, list);
  }

  const toInsert: Array<{ guildID: string; userID: string; type: string; date: number }> = [];

  for (const [guildID, guildEvents] of byGuild) {
    const userIDs = guildEvents.map((e) => e.userID);
    const existing = await MemberEvent.findAll({
      attributes: ["userID"],
      where: { guildID, userID: { [Op.in]: userIDs }, type: "join" },
    });
    const existingSet = new Set((existing as any[]).map((r) => r.userID));
    for (const e of guildEvents) {
      if (!existingSet.has(e.userID)) {
        toInsert.push({ ...e, type: "join" });
      }
    }
  }

  if (toInsert.length > 0) {
    await MemberEvent.bulkCreate(toInsert as any[]);
  }
}

export async function getMemberStatsOverview(
  guildID: string,
  startDate: number,
  endDate: number,
  options: MemberOverviewOptions = {},
): Promise<MemberOverview> {
  const includeHourly = options.includeHourly ?? true;
  const includeHourTimeline = options.includeHourTimeline ?? includeHourly;
  const [rows, allTimeRows, beforeRows] = await Promise.all([
    MemberEvent.findAll({
      attributes: ["userID", "type", "date"],
      where: { guildID, date: { [Op.between]: [startDate, endDate] } },
    }),
    MemberEvent.findAll({
      attributes: ["type"],
      where: { guildID },
    }),
    MemberEvent.findAll({
      attributes: ["type"],
      where: { guildID, date: { [Op.lt]: startDate } },
    }),
  ]);

  let allTimeJoined = 0;
  let allTimeLeft = 0;
  for (const r of allTimeRows as any[]) {
    if (r.type === "join") allTimeJoined++;
    else allTimeLeft++;
  }

  let beforeJoined = 0;
  let beforeLeft = 0;
  for (const r of beforeRows as any[]) {
    if (r.type === "join") beforeJoined++;
    else beforeLeft++;
  }
  const totalBeforePeriod = beforeJoined - beforeLeft;

  let totalJoined = 0;
  let totalLeft = 0;
  const byDay = new Map<string, MemberBucket>();
  const byHour = new Map<number, MemberBucket>();
  const byHourTimeline = new Map<string, MemberBucket>();

  for (const r of rows as any[]) {
    const isJoin = r.type === "join";
    const date = new Date(Number(r.date));
    const day = dayKey(date);
    const hour = date.getHours();
    const timeline = hourTimelineKey(date);

    if (isJoin) totalJoined++;
    else totalLeft++;

    const dayBucket = byDay.get(day) ?? createBucket();
    if (isJoin) dayBucket.joined++;
    else dayBucket.left++;
    byDay.set(day, dayBucket);

    if (includeHourly) {
      const hourBucket = byHour.get(hour) ?? createBucket();
      if (isJoin) hourBucket.joined++;
      else hourBucket.left++;
      byHour.set(hour, hourBucket);
    }
    if (includeHourTimeline) {
      const timelineBucket = byHourTimeline.get(timeline) ?? createBucket();
      if (isJoin) timelineBucket.joined++;
      else timelineBucket.left++;
      byHourTimeline.set(timeline, timelineBucket);
    }
  }

  return {
    summary: { total: allTimeJoined - allTimeLeft, joined: totalJoined, left: totalLeft },
    byDay: buildDaySeries(startDate, endDate, byDay, totalBeforePeriod),
    byHour: includeHourly ? buildHourSeries(byHour) : [],
    byHourTimeline: includeHourTimeline ? buildHourTimelineSeries(startDate, endDate, byHourTimeline, totalBeforePeriod) : [],
  };
}
