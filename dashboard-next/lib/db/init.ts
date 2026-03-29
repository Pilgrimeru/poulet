import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ATTACHMENTS_PATH, DB_PATH, sequelize } from "@/lib/db";
import "@/models";

let initPromise: Promise<void> | null = null;

export async function initializeDatabase(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    mkdirSync(ATTACHMENTS_PATH, { recursive: true });

    await sequelize.authenticate();
    await sequelize.sync();
  })();

  try {
    await initPromise;
  } catch (error) {
    initPromise = null;
    throw error;
  }
}
