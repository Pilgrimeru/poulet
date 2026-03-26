import { Router } from "express";
import {
  createMessageHistory,
  getLatestByUserInChannel,
  countGuildMessagesBetweenDatesByUserAndChannel,
} from "../services/messageHistoryService";

const router = Router();

router.post("/message-history", async (req, res, next) => {
  try {
    await createMessageHistory(req.body);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get("/message-history/latest", async (req, res, next) => {
  try {
    const { guildID, userID, channelID } = req.query as Record<string, string>;
    const result = await getLatestByUserInChannel(guildID, userID, channelID);
    result ? res.json(result) : res.status(404).json(null);
  } catch (err) {
    next(err);
  }
});

router.get("/message-history/count", async (req, res, next) => {
  try {
    const { guildID, startDate, endDate } = req.query as Record<string, string>;
    const result = await countGuildMessagesBetweenDatesByUserAndChannel(
      guildID,
      Number(startDate),
      Number(endDate),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
