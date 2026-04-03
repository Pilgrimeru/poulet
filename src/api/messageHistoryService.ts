import { apiGet, apiPost } from "./client";
import { MessageHistory } from "../database/models/MessageHistory";
import { Op } from "sequelize";

export interface MessageHistoryAttributes {
  userID: string;
  date: number;
  channelID: string;
  guildID: string;
  messageID: string;
}

export interface MessageCountByUserAndChannel {
  userID: string;
  channelID: string;
  messageCount: number;
}

export const messageHistoryService = {
  async createMessageHistory(data: MessageHistoryAttributes): Promise<void> {
    await apiPost("/message-history", data);
  },

  async getLatestByUserInChannel(
    guildID: string,
    userID: string,
    channelID: string,
  ): Promise<{ messageID: string } | null> {
    const params = new URLSearchParams({ guildID, userID, channelID });
    try {
      return await apiGet(`/message-history/latest?${params}`);
    } catch {
      return null;
    }
  },

  async countGuildMessagesBetweenDatesByUserAndChannel(
    guildID: string,
    startDate: number,
    endDate: number,
  ): Promise<MessageCountByUserAndChannel[]> {
    const rows = await MessageHistory.findAll({
      attributes: ["userID", "channelID"],
      where: { guildID, date: { [Op.between]: [startDate, endDate] } },
    });

    const countMap = new Map<
      string,
      { userID: string; channelID: string; messageCount: number }
    >();
    for (const row of rows as any[]) {
      const key = `${row.userID}:${row.channelID}`;
      if (!countMap.has(key)) {
        countMap.set(key, {
          userID: row.userID,
          channelID: row.channelID,
          messageCount: 0,
        });
      }
      countMap.get(key)!.messageCount += 1;
    }

    return Array.from(countMap.values());
  },
};
