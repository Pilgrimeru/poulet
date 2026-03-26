import { Router } from "express";
import {
  getRulesByGuildID,
  getRuleByID,
  createRule,
  updateRule,
  deleteRule,
} from "../services/spamFilterRuleService";

const router = Router();

router.get("/guilds/:guildID/spam-rules", async (req, res, next) => {
  try {
    res.json(await getRulesByGuildID(req.params["guildID"]!));
  } catch (err) {
    next(err);
  }
});

router.get("/guilds/:guildID/spam-rules/:id", async (req, res, next) => {
  try {
    const rule = await getRuleByID(req.params["guildID"]!, req.params["id"]!);
    rule ? res.json(rule) : res.status(404).json(null);
  } catch (err) {
    next(err);
  }
});

router.post("/guilds/:guildID/spam-rules", async (req, res, next) => {
  try {
    const rule = await createRule({ ...req.body, guildID: req.params["guildID"]! });
    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
});

router.patch("/guilds/:guildID/spam-rules/:id", async (req, res, next) => {
  try {
    const rule = await updateRule(req.params["guildID"]!, req.params["id"]!, req.body);
    rule ? res.json(rule) : res.status(404).json(null);
  } catch (err) {
    next(err);
  }
});

router.delete("/guilds/:guildID/spam-rules/:id", async (req, res, next) => {
  try {
    const deleted = await deleteRule(req.params["guildID"]!, req.params["id"]!);
    res.json({ deleted });
  } catch (err) {
    next(err);
  }
});

export default router;
