import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ATTACHMENTS_PATH, DB_PATH, sequelize } from "@/lib/db";
import "@/models";
import { QueryTypes } from "sequelize";

let initPromise: Promise<void> | null = null;

const MODERATION_TABLE_REQUIREMENTS: Record<string, string[]> = {
  Warns: ["id", "guildID", "userID", "moderatorID", "reason", "severity", "isActive", "createdAt", "expiresAt"],
  Sanctions: ["id", "guildID", "userID", "moderatorID", "type", "reason", "warnID", "isActive", "durationMs", "createdAt", "expiresAt"],
  FlaggedMessages: ["id", "guildID", "channelID", "messageID", "reporterID", "targetUserID", "status", "aiAnalysis", "warnID", "sanctionID", "appealText", "appealStatus", "appealAt", "moderatorID", "createdAt"],
  ModerationReports: ["id", "guildID", "reporterID", "targetUserID", "ticketChannelID", "status", "reporterSummary", "aiQuestions", "aiQQOQCCP", "confirmationCount", "warnID", "sanctionID", "appealText", "appealStatus", "appealAt", "moderatorID", "createdAt"],
};

async function backupLegacyModerationTables(): Promise<void> {
  const qi = sequelize.getQueryInterface();

  for (const [tableName, expectedColumns] of Object.entries(MODERATION_TABLE_REQUIREMENTS)) {
    try {
      const description = await qi.describeTable(tableName);
      const existingColumns = new Set(Object.keys(description));
      const isCompatible = expectedColumns.every((column) => existingColumns.has(column));
      if (isCompatible) continue;

      const backupName = `${tableName}_legacy_${Date.now()}`;
      console.warn(`[dashboard] Legacy schema detected for ${tableName}. Backing up to ${backupName}.`);
      await sequelize.query(`ALTER TABLE "${tableName}" RENAME TO "${backupName}"`);
    } catch (error) {
      const message = String(error);
      if (
        message.includes("No description found for") ||
        message.includes("does not exist") ||
        message.includes("no such table")
      ) {
        continue;
      }
      throw error;
    }
  }
}

async function dropLegacyModerationIndexes(): Promise<void> {
  const rows = await sequelize.query<{ name: string }>(
    `
      SELECT name
      FROM sqlite_master
      WHERE type = 'index'
        AND name NOT LIKE 'sqlite_autoindex_%'
        AND (
          tbl_name LIKE 'Warns_legacy_%'
          OR tbl_name LIKE 'Sanctions_legacy_%'
          OR tbl_name LIKE 'FlaggedMessages_legacy_%'
          OR tbl_name LIKE 'ModerationReports_legacy_%'
        )
    `,
    { type: QueryTypes.SELECT },
  );

  for (const row of rows) {
    await sequelize.query(`DROP INDEX IF EXISTS "${row.name}"`);
  }
}

export async function initializeDatabase(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    mkdirSync(ATTACHMENTS_PATH, { recursive: true });

    await sequelize.authenticate();
    await backupLegacyModerationTables();
    await dropLegacyModerationIndexes();
    await sequelize.sync();
  })();

  try {
    await initPromise;
  } catch (error) {
    initPromise = null;
    throw error;
  }
}
