import { DataTypes, Op } from "sequelize";
import { ChannelMeta } from "../models/ChannelMeta";
import { sequelize } from "../lib/db";

let schemaReady = false;

export async function ensureChannelMetaSchema(): Promise<void> {
  return ensureColumns();
}

async function ensureColumns(): Promise<void> {
  if (schemaReady) return;
  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable("ChannelMeta");
  const cols = [
    { name: "parentID", type: DataTypes.STRING, defaultValue: null, allowNull: true },
    { name: "parentName", type: DataTypes.STRING, defaultValue: null, allowNull: true },
    { name: "channelType", type: DataTypes.INTEGER, defaultValue: null, allowNull: true },
    { name: "isDeleted", type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
  ];
  for (const col of cols) {
    if (!table[col.name]) {
      await qi.addColumn("ChannelMeta", col.name, { type: col.type, allowNull: col.allowNull, defaultValue: col.defaultValue });
    }
  }
  schemaReady = true;
}

export async function upsertChannelMeta(
  channelID: string,
  guildID: string,
  name: string,
  parentID?: string | null,
  parentName?: string | null,
  channelType?: number | null,
): Promise<void> {
  await ensureColumns();
  await ChannelMeta.upsert({ channelID, guildID, name, parentID: parentID ?? null, parentName: parentName ?? null, channelType: channelType ?? null, isDeleted: false });
}

export async function upsertChannelMetas(rows: Array<{
  channelID: string;
  guildID: string;
  name: string;
  parentID?: string | null;
  parentName?: string | null;
  channelType?: number | null;
}>): Promise<void> {
  if (rows.length === 0) return;
  await ensureColumns();
  await ChannelMeta.bulkCreate(
    rows.map((row) => ({
      channelID: row.channelID,
      guildID: row.guildID,
      name: row.name,
      parentID: row.parentID ?? null,
      parentName: row.parentName ?? null,
      channelType: row.channelType ?? null,
      isDeleted: false,
    })),
    {
      updateOnDuplicate: ["guildID", "name", "parentID", "parentName", "channelType", "isDeleted"],
    },
  );
}

export async function markChannelDeleted(channelID: string): Promise<void> {
  await ensureColumns();
  await ChannelMeta.update({ isDeleted: true }, { where: { channelID } });
}

export async function markChannelsDeletedExcept(guildID: string, activeChannelIDs: string[]): Promise<void> {
  await ensureColumns();
  await ChannelMeta.update(
    { isDeleted: true },
    { where: { guildID, channelID: { [Op.notIn]: activeChannelIDs }, isDeleted: false } },
  );
}
