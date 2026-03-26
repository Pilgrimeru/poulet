import { Router } from "express";
import {
  getChannelMessages,
  getMessageHistory,
  saveSnapshot,
  getNextVersion,
  markDeleted,
  purgeOldSnapshots,
} from "../services/messageSnapshotService";

const router = Router();

router.get("/channels/:channelId/messages", async (req, res, next) => {
  try {
    const { guildId, before, after, limit, search, authorID, onlyDeleted } = req.query as Record<string, string | undefined>;
    if (!guildId) {
      res.status(400).json({ error: "guildId query param is required" });
      return;
    }
    const messages = await getChannelMessages(
      guildId,
      req.params["channelId"]!,
      limit ? Number.parseInt(limit) : 50,
      {
        before:      before      ? Number.parseInt(before)      : undefined,
        after:       after       ? Number.parseInt(after)       : undefined,
        search:      search      || undefined,
        authorID:    authorID    || undefined,
        onlyDeleted: onlyDeleted === "true",
      },
    );
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

router.get("/messages/:messageId/history", async (req, res, next) => {
  try {
    const history = await getMessageHistory(req.params["messageId"]!);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

router.post("/messages/snapshot", async (req, res, next) => {
  try {
    const { data, attachments, version, isDeleted } = req.body;
    await saveSnapshot(data, attachments ?? [], version ?? 0, isDeleted ?? false);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get("/messages/:messageId/next-version", async (req, res, next) => {
  try {
    const version = await getNextVersion(req.params["messageId"]);
    res.json({ version });
  } catch (err) {
    next(err);
  }
});

router.post("/messages/:messageId/mark-deleted", async (req, res, next) => {
  try {
    await markDeleted(req.params["messageId"]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post("/messages/purge", async (_req, res, next) => {
  try {
    const deleted = await purgeOldSnapshots();
    res.json({ deleted });
  } catch (err) {
    next(err);
  }
});

export default router;
