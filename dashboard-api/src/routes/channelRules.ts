import { Router } from "express";
import {
  getRulesByGuildID,
  getRuleByChannel,
  getRuleByID,
  upsertRule,
  deleteRule,
} from "../services/channelRuleService";

const router = Router();

router.get("/guilds/:guildID/channel-rules", async (req, res, next) => {
  try {
    res.json(await getRulesByGuildID(req.params["guildID"]!));
  } catch (err) {
    next(err);
  }
});

router.get("/guilds/:guildID/channel-rules/by-channel/:channelID", async (req, res, next) => {
  try {
    const rule = await getRuleByChannel(req.params["guildID"]!, req.params["channelID"]!);
    rule ? res.json(rule) : res.status(404).json(null);
  } catch (err) {
    next(err);
  }
});

router.get("/guilds/:guildID/channel-rules/by-id/:id", async (req, res, next) => {
  try {
    const rule = await getRuleByID(req.params["guildID"]!, req.params["id"]!);
    rule ? res.json(rule) : res.status(404).json(null);
  } catch (err) {
    next(err);
  }
});

router.put("/guilds/:guildID/channel-rules/:channelID", async (req, res, next) => {
  try {
    const rule = await upsertRule(req.params["guildID"]!, req.params["channelID"]!, req.body);
    res.json(rule);
  } catch (err) {
    next(err);
  }
});

router.delete("/guilds/:guildID/channel-rules/:channelID", async (req, res, next) => {
  try {
    const deleted = await deleteRule(req.params["guildID"]!, req.params["channelID"]!);
    res.json({ deleted });
  } catch (err) {
    next(err);
  }
});

export default router;
