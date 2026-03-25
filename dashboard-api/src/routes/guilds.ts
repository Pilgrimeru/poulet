import { Router } from "express";
import { getDistinctChannels, getDistinctGuilds } from "../services/messageSnapshotService";

const router = Router();

router.get("/guilds", async (_req, res, next) => {
  try {
    const guilds = await getDistinctGuilds();
    res.json(guilds);
  } catch (err) {
    next(err);
  }
});

router.get("/guilds/:guildId/channels", async (req, res, next) => {
  try {
    const channels = await getDistinctChannels(req.params["guildId"]!);
    res.json(channels);
  } catch (err) {
    next(err);
  }
});

export default router;
