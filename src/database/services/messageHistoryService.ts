import { col, fn, Op } from "sequelize";
import { MessageHistory, MessageHistoryAttributes } from "@/database/models";

class MessageHistoryService {
  async createMessageHistory(
    data: MessageHistoryAttributes,
  ): Promise<MessageHistory> {
    return await MessageHistory.create(data);
  }

  async deleteMessageHistory(userID: string, date: number): Promise<void> {
    await MessageHistory.destroy({
      where: {
        userID,
        date,
      },
    });
  }

  async updateMessageHistory(
    userID: string,
    date: number,
    newData: Partial<MessageHistoryAttributes>,
  ): Promise<[affectedCount: number]> {
    return await MessageHistory.update(newData, {
      where: {
        userID,
        date,
      },
    });
  }

  async countGuildMessagesBetweenDatesByUser(
    guildID: string,
    startDate: number,
    endDate: number,
  ): Promise<any[]> {
    return await MessageHistory.findAll({
      attributes: ["userID", [fn("COUNT", col("userID")), "messageCount"]],
      where: {
        guildID,
        date: {
          [Op.between]: [startDate, endDate],
        },
      },
      group: ["userID"],
    });
  }

  async countGuildMessagesBetweenDatesByUserAndChannel(
    guildID: string,
    startDate: number,
    endDate: number,
  ): Promise<any[]> {
    return await MessageHistory.findAll({
      attributes: [
        "userID",
        "channelID",
        [fn("COUNT", col("userID")), "messageCount"],
      ],
      where: {
        guildID,
        date: {
          [Op.between]: [startDate, endDate],
        },
      },
      group: ["userID", "channelID"],
    });
  }
}

export const messageHistoryService = new MessageHistoryService();
