import { DataTypes } from "sequelize";
import { ChannelMeta } from "../db/models/ChannelMeta";
import { sequelize } from "../db/sequelize";

let schemaReady = false;

async function ensureColumns(): Promise<void> {
  if (schemaReady) return;
  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable("ChannelMeta");
  const cols = [
    { name: "parentID", type: DataTypes.STRING, defaultValue: null },
    { name: "parentName", type: DataTypes.STRING, defaultValue: null },
    { name: "channelType", type: DataTypes.INTEGER, defaultValue: null },
  ];
  for (const col of cols) {
    if (!table[col.name]) {
      await qi.addColumn("ChannelMeta", col.name, { type: col.type, allowNull: true, defaultValue: col.defaultValue });
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
  await ChannelMeta.upsert({ channelID, guildID, name, parentID: parentID ?? null, parentName: parentName ?? null, channelType: channelType ?? null });
}
