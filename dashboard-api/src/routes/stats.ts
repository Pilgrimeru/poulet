import { Router } from "express";
import {
  getMessageStatsByChannel,
  getMessageStatsByDay,
  getMessageStatsByHour,
  getMessageStatsByHourTimeline,
  getMessageStatsByUser,
  getVoiceStatsByChannel,
  getVoiceStatsByDay,
  getVoiceStatsByHour,
  getVoiceStatsByHourTimeline,
  getVoiceStatsByUser,
  getUserMetas,
} from "../services/statsService";

const router = Router();

function parseRange(req: any): { guildID: string; startDate: number; endDate: number } {
  const { guildID, startDate, endDate } = req.query as Record<string, string>;
  return { guildID, startDate: Number(startDate), endDate: Number(endDate) };
}

router.get("/guilds/:guildID/stats/messages/by-day", async (req, res, next) => {
  try {
    const { guildID } = req.params;
    const { startDate, endDate } = parseRange(req);
    res.json(await getMessageStatsByDay(guildID, startDate, endDate));
  } catch (err) { next(err); }
});

router.get("/guilds/:guildID/stats/messages/by-hour", async (req, res, next) => {
  try {
    const { guildID } = req.params;
    const { startDate, endDate } = parseRange(req);
    res.json(await getMessageStatsByHour(guildID, startDate, endDate));
  } catch (err) { next(err); }
});

router.get("/guilds/:guildID/stats/messages/by-channel", async (req, res, next) => {
  try {
    const { guildID } = req.params;
    const { startDate, endDate } = parseRange(req);
    res.json(await getMessageStatsByChannel(guildID, startDate, endDate));
  } catch (err) { next(err); }
});

router.get("/guilds/:guildID/stats/messages/by-user", async (req, res, next) => {
  try {
    const { guildID } = req.params;
    const { startDate, endDate } = parseRange(req);
    const rows = await getMessageStatsByUser(guildID, startDate, endDate);
    const metas = await getUserMetas(rows.map((r) => r.userID));
    res.json(rows.map((r) => ({ ...r, ...(metas.get(r.userID) ?? {}) })));
  } catch (err) { next(err); }
});

router.get("/guilds/:guildID/stats/voice/by-day", async (req, res, next) => {
  try {
    const { guildID } = req.params;
    const { startDate, endDate } = parseRange(req);
    res.json(await getVoiceStatsByDay(guildID, startDate, endDate));
  } catch (err) { next(err); }
});

router.get("/guilds/:guildID/stats/voice/by-hour", async (req, res, next) => {
  try {
    const { guildID } = req.params;
    const { startDate, endDate } = parseRange(req);
    res.json(await getVoiceStatsByHour(guildID, startDate, endDate));
  } catch (err) { next(err); }
});

router.get("/guilds/:guildID/stats/voice/by-channel", async (req, res, next) => {
  try {
    const { guildID } = req.params;
    const { startDate, endDate } = parseRange(req);
    res.json(await getVoiceStatsByChannel(guildID, startDate, endDate));
  } catch (err) { next(err); }
});

router.get("/guilds/:guildID/stats/voice/by-user", async (req, res, next) => {
  try {
    const { guildID } = req.params;
    const { startDate, endDate } = parseRange(req);
    const rows = await getVoiceStatsByUser(guildID, startDate, endDate);
    const metas = await getUserMetas(rows.map((r) => r.userID));
    res.json(rows.map((r) => ({ ...r, ...(metas.get(r.userID) ?? {}) })));
  } catch (err) { next(err); }
});

router.get("/guilds/:guildID/stats/messages/by-hour-timeline", async (req, res, next) => {
  try {
    const { guildID } = req.params;
    const { startDate, endDate } = parseRange(req);
    res.json(await getMessageStatsByHourTimeline(guildID, startDate, endDate));
  } catch (err) { next(err); }
});

router.get("/guilds/:guildID/stats/voice/by-hour-timeline", async (req, res, next) => {
  try {
    const { guildID } = req.params;
    const { startDate, endDate } = parseRange(req);
    res.json(await getVoiceStatsByHourTimeline(guildID, startDate, endDate));
  } catch (err) { next(err); }
});

export default router;
