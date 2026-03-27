import path from "path";
import { Sequelize } from "sequelize";

const DB_PATH =
  process.env["DATABASE_PATH"] ??
  path.resolve(process.cwd(), "../database/database.sqlite");

export const ATTACHMENTS_PATH =
  process.env["ATTACHMENTS_PATH"] ??
  path.resolve(process.cwd(), "../database/attachments");

// Singleton — prevents multiple instances during Next.js hot reload in dev
const globalForDb = globalThis as unknown as { _sequelize?: Sequelize };

export const sequelize =
  globalForDb._sequelize ??
  new Sequelize({ dialect: "sqlite", storage: DB_PATH, logging: false });

if (process.env.NODE_ENV !== "production") {
  globalForDb._sequelize = sequelize;
}
