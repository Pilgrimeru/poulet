import cors from "cors";
import express from "express";
import { resolve } from "node:path";
import { sequelize } from "./db/sequelize";
import { errorHandler } from "./middleware/errorHandler";
import guildsRouter from "./routes/guilds";
import messagesRouter from "./routes/messages";

// Ensure models are registered with the sequelize instance
import "./db/models/ChannelMeta";
import "./db/models/GuildMeta";
import "./db/models/MessageSnapshot";
import "./db/models/MessageAttachment";

const app = express();
const PORT = process.env["PORT"] ?? 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
app.use("/attachments", express.static(resolve(__dirname, "../../database/attachments")));
app.use("/api", guildsRouter);
app.use("/api", messagesRouter);
app.use(errorHandler);

try {
  await sequelize.authenticate();
  app.listen(PORT, () => console.log(`[dashboard-api] Running on http://localhost:${PORT}`));
} catch (err) {
  console.error("[dashboard-api] DB connection failed:", err);
  process.exit(1);
}
