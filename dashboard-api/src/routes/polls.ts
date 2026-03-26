import { Router } from "express";
import {
  createPoll,
  getPoll,
  closePoll,
  getAllActivePolls,
  deletePoll,
  addParticipation,
  removeParticipation,
  removeAllParticipations,
  getUserParticipation,
  getUserParticipations,
  getAllParticipations,
} from "../services/pollService";

const router = Router();

router.post("/polls", async (req, res, next) => {
  try {
    res.status(201).json(await createPoll(req.body));
  } catch (err) {
    next(err);
  }
});

router.get("/polls/active", async (_req, res, next) => {
  try {
    res.json(await getAllActivePolls());
  } catch (err) {
    next(err);
  }
});

router.get("/polls/:pollId", async (req, res, next) => {
  try {
    const poll = await getPoll(req.params["pollId"]!);
    poll ? res.json(poll) : res.status(404).json(null);
  } catch (err) {
    next(err);
  }
});

router.post("/polls/:pollId/close", async (req, res, next) => {
  try {
    await closePoll(req.params["pollId"]!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.delete("/polls/:pollId", async (req, res, next) => {
  try {
    await deletePoll(req.params["pollId"]!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post("/polls/:pollId/participations", async (req, res, next) => {
  try {
    const { userId, option } = req.body;
    const result = await addParticipation(req.params["pollId"]!, userId, Number(option));
    result ? res.json(result) : res.status(404).json(null);
  } catch (err) {
    next(err);
  }
});

router.delete("/polls/:pollId/participations", async (req, res, next) => {
  try {
    const { userId, option } = req.query as Record<string, string>;
    const deleted = await removeParticipation(req.params["pollId"]!, userId, Number(option));
    res.json({ deleted });
  } catch (err) {
    next(err);
  }
});

router.delete("/polls/:pollId/participations/all", async (req, res, next) => {
  try {
    const { userId } = req.query as Record<string, string>;
    const deleted = await removeAllParticipations(req.params["pollId"]!, userId);
    res.json({ deleted });
  } catch (err) {
    next(err);
  }
});

router.get("/polls/:pollId/participations", async (req, res, next) => {
  try {
    const { userId, option } = req.query as Record<string, string | undefined>;
    if (userId && option !== undefined) {
      const result = await getUserParticipation(req.params["pollId"]!, userId, Number(option));
      return result ? res.json(result) : res.status(404).json(null);
    }
    if (userId) {
      return res.json(await getUserParticipations(req.params["pollId"]!, userId));
    }
    res.json(await getAllParticipations(req.params["pollId"]!));
  } catch (err) {
    next(err);
  }
});

export default router;
