import { Router } from "express";
import { getByGuildID, updateByGuildID, invalidateCache } from "../services/guildSettingsService";

const router = Router();

router.get("/guilds/:guildID/settings", async (req, res, next) => {
  try {
    res.json(await getByGuildID(req.params["guildID"]!));
  } catch (err) {
    next(err);
  }
});

router.patch("/guilds/:guildID/settings", async (req, res, next) => {
  try {
    res.json(await updateByGuildID(req.params["guildID"]!, req.body));
  } catch (err) {
    next(err);
  }
});

router.delete("/guilds/:guildID/settings/cache", (req, res) => {
  invalidateCache(req.params["guildID"]!);
  res.status(204).end();
});

export default router;
