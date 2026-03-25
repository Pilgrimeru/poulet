import { Router } from "express";
import { getChannelMessages, getMessageHistory } from "../services/messageSnapshotService";

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

export default router;
