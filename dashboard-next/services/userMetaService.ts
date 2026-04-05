import { DataTypes, Op } from "sequelize";
import { sequelize } from "../lib/db";
import { UserMeta } from "../models/UserMeta";

let schemaReady = false;

async function ensureTable(): Promise<void> {
  if (schemaReady) return;
  await UserMeta.sync({ force: false });
  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable("UserMetas").catch(() => null);
  if (table && !table["isDeleted"]) {
    await qi.addColumn("UserMetas", "isDeleted", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
  }
  schemaReady = true;
}

export async function upsertUserMeta(
  userID: string,
  guildID: string,
  username: string,
  displayName: string,
  avatarURL: string,
): Promise<void> {
  await ensureTable();
  await UserMeta.upsert({ userID, guildID, username, displayName, avatarURL, isDeleted: false, updatedAt: Date.now() });
}

export async function bulkUpsertUserMetas(rows: Array<{
  userID: string;
  guildID: string;
  username: string;
  displayName: string;
  avatarURL: string;
}>): Promise<void> {
  if (rows.length === 0) return;
  await ensureTable();
  await UserMeta.bulkCreate(
    rows.map((r) => ({ ...r, isDeleted: false, updatedAt: Date.now() })),
    { updateOnDuplicate: ["username", "displayName", "avatarURL", "isDeleted", "updatedAt"] },
  );
}

export async function markUserDeleted(userID: string, guildID: string): Promise<void> {
  await ensureTable();
  await UserMeta.update({ isDeleted: true }, { where: { userID, guildID } });
}

export async function markUsersDeletedExcept(guildID: string, activeUserIDs: string[]): Promise<void> {
  await ensureTable();
  await UserMeta.update(
    { isDeleted: true },
    { where: { guildID, userID: { [Op.notIn]: activeUserIDs }, isDeleted: false } },
  );
}

export async function getUserMetasByIDs(
  guildID: string,
  userIDs: string[],
): Promise<Map<string, { userID: string; username: string; displayName: string; avatarURL: string }>> {
  if (userIDs.length === 0) return new Map();
  await ensureTable();
  const rows = await UserMeta.findAll({
    attributes: ["userID", "username", "displayName", "avatarURL"],
    where: { guildID, userID: { [Op.in]: userIDs } },
  });
  const map = new Map<string, { userID: string; username: string; displayName: string; avatarURL: string }>();
  for (const r of rows as any[]) {
    map.set(r.userID, { userID: r.userID, username: r.username, displayName: r.displayName, avatarURL: r.avatarURL });
  }
  return map;
}
