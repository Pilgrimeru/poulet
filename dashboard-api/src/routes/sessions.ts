import { Router } from "express";
import {
  createVoiceSession,
  createDeafSession,
  getVoiceSessionsInIntersection,
  getDeafSessionsInIntersection,
} from "../services/sessionService";

const router = Router();

router.post("/sessions/voice", async (req, res, next) => {
  try {
    await createVoiceSession(req.body);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post("/sessions/deaf", async (req, res, next) => {
  try {
    await createDeafSession(req.body);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get("/sessions/voice", async (req, res, next) => {
  try {
    const { guildID, start, end } = req.query as Record<string, string>;
    res.json(await getVoiceSessionsInIntersection(guildID, Number(start), Number(end)));
  } catch (err) {
    next(err);
  }
});

router.get("/sessions/deaf", async (req, res, next) => {
  try {
    const { guildID, start, end } = req.query as Record<string, string>;
    res.json(await getDeafSessionsInIntersection(guildID, Number(start), Number(end)));
  } catch (err) {
    next(err);
  }
});

export default router;
