import { Router } from "express";
import { upsertChannelMeta } from "../services/channelMetaService";

const router = Router();

router.post("/channel-meta", async (req, res, next) => {
  try {
    const { channelID, guildID, name, parentID, parentName, channelType } = req.body;
    await upsertChannelMeta(channelID, guildID, name, parentID, parentName, channelType);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
