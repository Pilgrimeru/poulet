import { col, DataTypes, fn, Op } from "sequelize";
import { MessageHistory } from "../models/MessageHistory";
import { sequelize } from "../lib/db";

export interface MessageHistoryAttributes {
  userID: string;
  date: number;
  channelID: string;
  guildID: string;
  messageID: string;
}

let schemaReady = false;

async function ensureColumns(): Promise<void> {
  if (schemaReady) return;
  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable("MessageHistories");
  if (!table["messageID"]) {
    await qi.addColumn("MessageHistories", "messageID", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "",
    });
  }
  schemaReady = true;
}

export async function createMessageHistory(data: MessageHistoryAttributes): Promise<void> {
  await ensureColumns();
  await MessageHistory.create(data as any);
}

export async function getLatestByUserInChannel(
  guildID: string,
  userID: string,
  channelID: string,
): Promise<{ messageID: string } | null> {
  await ensureColumns();
  const row = await MessageHistory.findOne({
    where: { guildID, userID, channelID },
    order: [["date", "DESC"]],
  });
  return row ? { messageID: row.messageID } : null;
}

export interface MessageCountByUser {
  userID: string;
  messageCount: number;
}

export interface MessageCountByUserAndChannel {
  userID: string;
  channelID: string;
  messageCount: number;
}

export async function countGuildMessagesBetweenDatesByUser(
  guildID: string,
  startDate: number,
  endDate: number,
): Promise<MessageCountByUser[]> {
  const rows = await MessageHistory.findAll({
    attributes: ["userID", [fn("COUNT", col("userID")), "messageCount"]],
    where: { guildID, date: { [Op.between]: [startDate, endDate] } },
    group: ["userID"],
  });
  return rows.map((r: any) => ({ userID: r.userID, messageCount: Number(r.dataValues.messageCount) }));
}

export async function countGuildMessagesBetweenDatesByUserAndChannel(
  guildID: string,
  startDate: number,
  endDate: number,
): Promise<MessageCountByUserAndChannel[]> {
  const rows = await MessageHistory.findAll({
    attributes: ["userID", "channelID", [fn("COUNT", col("userID")), "messageCount"]],
    where: { guildID, date: { [Op.between]: [startDate, endDate] } },
    group: ["userID", "channelID"],
  });
  return rows.map((r: any) => ({
    userID: r.userID,
    channelID: r.channelID,
    messageCount: Number(r.dataValues.messageCount),
  }));
}
