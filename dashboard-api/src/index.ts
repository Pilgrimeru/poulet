import cors from "cors";
import express from "express";
import { resolve } from "node:path";
import { sequelize } from "./db/sequelize";
import { errorHandler } from "./middleware/errorHandler";
import guildsRouter from "./routes/guilds";
import messagesRouter from "./routes/messages";
import channelMetaRouter from "./routes/channelMeta";
import guildMetaRouter from "./routes/guildMeta";
import channelRulesRouter from "./routes/channelRules";
import guildSettingsRouter from "./routes/guildSettings";
import messageHistoryRouter from "./routes/messageHistory";
import spamRulesRouter from "./routes/spamRules";
import sessionsRouter from "./routes/sessions";
import pollsRouter from "./routes/polls";
import statsReportStateRouter from "./routes/statsReportState";
import statsRouter from "./routes/stats";

// Ensure models are registered with the sequelize instance
import "./db/models/ChannelMeta";
import "./db/models/GuildMeta";
import "./db/models/MessageSnapshot";
import "./db/models/MessageAttachment";
import "./db/models/ChannelRule";
import "./db/models/DeafSession";
import "./db/models/GuildSettings";
import "./db/models/MessageHistory";
import "./db/models/Poll";
import "./db/models/PollParticipation";
import "./db/models/SpamFilterRule";
import "./db/models/StatsReportMessageState";
import "./db/models/VoiceSession";

const app = express();
const PORT = process.env["PORT"] ?? 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
app.use("/attachments", express.static(resolve(__dirname, "../../database/attachments")));
app.use("/api", guildsRouter);
app.use("/api", messagesRouter);
app.use("/api", channelMetaRouter);
app.use("/api", guildMetaRouter);
app.use("/api", channelRulesRouter);
app.use("/api", guildSettingsRouter);
app.use("/api", messageHistoryRouter);
app.use("/api", spamRulesRouter);
app.use("/api", sessionsRouter);
app.use("/api", pollsRouter);
app.use("/api", statsReportStateRouter);
app.use("/api", statsRouter);
app.use(errorHandler);

try {
  await sequelize.authenticate();
  app.listen(PORT, () => console.log(`[dashboard-api] Running on http://localhost:${PORT}`));
} catch (err) {
  console.error("[dashboard-api] DB connection failed:", err);
  process.exit(1);
}
