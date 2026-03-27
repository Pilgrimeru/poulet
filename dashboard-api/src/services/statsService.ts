import { Op } from "sequelize";
import { MessageHistory } from "../db/models/MessageHistory";
import { MessageSnapshot } from "../db/models/MessageSnapshot";
import { VoiceSession } from "../db/models/VoiceSession";

export interface UserMeta {
  userID: string;
  username: string;
  displayName: string;
  avatarURL: string;
}

export async function getUserMetas(userIDs: string[]): Promise<Map<string, UserMeta>> {
  if (userIDs.length === 0) return new Map();
  const rows = await MessageSnapshot.findAll({
    attributes: ["authorID", "authorUsername", "authorDisplayName", "authorAvatarURL", "snapshotAt"],
    where: { authorID: { [Op.in]: userIDs } },
    order: [["snapshotAt", "DESC"]],
  });
  const map = new Map<string, UserMeta>();
  for (const r of rows as any[]) {
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

export interface DailyValue {
  date: string; // "YYYY-MM-DD"
  value: number;
}

export interface HourlyValue {
  hour: number; // 0-23
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

// ─── Messages ────────────────────────────────────────────────────────────────

export async function getMessageStatsByDay(
  guildID: string,
  startDate: number,
  endDate: number,
): Promise<DailyValue[]> {
  const rows = await MessageHistory.findAll({
    attributes: ["date"],
    where: { guildID, date: { [Op.between]: [startDate, endDate] } },
  });

  const map = new Map<string, number>();
  for (const r of rows as any[]) {
    const d = new Date(Number(r.date));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getMessageStatsByHour(
  guildID: string,
  startDate: number,
  endDate: number,
): Promise<HourlyValue[]> {
  const rows = await MessageHistory.findAll({
    attributes: ["date"],
    where: { guildID, date: { [Op.between]: [startDate, endDate] } },
  });

  const map = new Map<number, number>();
  for (const r of rows as any[]) {
    const h = new Date(Number(r.date)).getHours();
    map.set(h, (map.get(h) ?? 0) + 1);
  }

  const result: HourlyValue[] = [];
  for (let h = 0; h < 24; h++) {
    result.push({ hour: h, value: map.get(h) ?? 0 });
  }
  return result;
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

export interface HourlyTimelineValue {
  datetime: string; // "YYYY-MM-DD HH"
  value: number;
}

export async function getMessageStatsByHourTimeline(
  guildID: string,
  startDate: number,
  endDate: number,
): Promise<HourlyTimelineValue[]> {
  const rows = await MessageHistory.findAll({
    attributes: ["date"],
    where: { guildID, date: { [Op.between]: [startDate, endDate] } },
  });

  const map = new Map<string, number>();
  for (const r of rows as any[]) {
    const d = new Date(Number(r.date));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([datetime, value]) => ({ datetime, value }))
    .sort((a, b) => a.datetime.localeCompare(b.datetime));
}

// ─── Voice (duration in seconds) ─────────────────────────────────────────────

function clamp(session: { start: number; end: number }, start: number, end: number) {
  return Math.max(0, Math.min(session.end, end) - Math.max(session.start, start));
}

export async function getVoiceStatsByDay(
  guildID: string,
  startDate: number,
  endDate: number,
): Promise<DailyValue[]> {
  const rows = await VoiceSession.findAll({
    attributes: ["start", "end"],
    where: {
      guildID,
      [Op.and]: [{ start: { [Op.lte]: endDate } }, { end: { [Op.gte]: startDate } }],
    },
  });

  const map = new Map<string, number>();

  for (const r of rows as any[]) {
    const session = { start: Number(r.start), end: Number(r.end) };
    // Iterate over days covered by this session
    let cursor = new Date(Math.max(session.start, startDate));
    cursor.setHours(0, 0, 0, 0);

    while (cursor.getTime() <= Math.min(session.end, endDate)) {
      const dayStart = cursor.getTime();
      const dayEnd = dayStart + 86400000;
      const secs = clamp(session, dayStart, dayEnd) / 1000;
      if (secs > 0) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        map.set(key, (map.get(key) ?? 0) + secs);
      }
      cursor = new Date(dayEnd);
    }
  }

  return Array.from(map.entries())
    .map(([date, value]) => ({ date, value: Math.round(value) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getVoiceStatsByHour(
  guildID: string,
  startDate: number,
  endDate: number,
): Promise<HourlyValue[]> {
  const rows = await VoiceSession.findAll({
    attributes: ["start", "end"],
    where: {
      guildID,
      [Op.and]: [{ start: { [Op.lte]: endDate } }, { end: { [Op.gte]: startDate } }],
    },
  });

  const map = new Map<number, number>();

  for (const r of rows as any[]) {
    const session = { start: Number(r.start), end: Number(r.end) };
    let cursor = new Date(Math.max(session.start, startDate));
    cursor.setMinutes(0, 0, 0);

    while (cursor.getTime() <= Math.min(session.end, endDate)) {
      const hourStart = cursor.getTime();
      const hourEnd = hourStart + 3600000;
      const secs = clamp(session, hourStart, hourEnd) / 1000;
      if (secs > 0) {
        const h = cursor.getHours();
        map.set(h, (map.get(h) ?? 0) + secs);
      }
      cursor = new Date(hourEnd);
    }
  }

  const result: HourlyValue[] = [];
  for (let h = 0; h < 24; h++) {
    result.push({ hour: h, value: Math.round(map.get(h) ?? 0) });
  }
  return result;
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
  const rows = await VoiceSession.findAll({
    attributes: ["start", "end"],
    where: {
      guildID,
      [Op.and]: [{ start: { [Op.lte]: endDate } }, { end: { [Op.gte]: startDate } }],
    },
  });

  const map = new Map<string, number>();

  for (const r of rows as any[]) {
    const session = { start: Number(r.start), end: Number(r.end) };
    let cursor = new Date(Math.max(session.start, startDate));
    cursor.setMinutes(0, 0, 0);

    while (cursor.getTime() <= Math.min(session.end, endDate)) {
      const hourStart = cursor.getTime();
      const hourEnd = hourStart + 3600000;
      const secs = clamp(session, hourStart, hourEnd) / 1000;
      if (secs > 0) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")} ${String(cursor.getHours()).padStart(2, "0")}`;
        map.set(key, (map.get(key) ?? 0) + secs);
      }
      cursor = new Date(hourEnd);
    }
  }

  return Array.from(map.entries())
    .map(([datetime, value]) => ({ datetime, value: Math.round(value) }))
    .sort((a, b) => a.datetime.localeCompare(b.datetime));
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
