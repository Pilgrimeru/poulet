import { Router } from "express";
import { upsertGuildMeta } from "../services/guildMetaService";

const router = Router();

router.post("/guild-meta", async (req, res, next) => {
  try {
    const { guildID, name, iconURL } = req.body;
    await upsertGuildMeta(guildID, name, iconURL);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
