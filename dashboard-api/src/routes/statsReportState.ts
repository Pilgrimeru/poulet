import { Router } from "express";
import { getMessageID, upsertState } from "../services/statsReportMessageStateService";

const router = Router();

router.get("/guilds/:guildID/stats-report-state", async (req, res, next) => {
  try {
    const id = await getMessageID(req.params["guildID"]!);
    res.json({ messageID: id ?? null });
  } catch (err) {
    next(err);
  }
});

router.put("/guilds/:guildID/stats-report-state", async (req, res, next) => {
  try {
    await upsertState(req.params["guildID"]!, req.body.messageID);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
