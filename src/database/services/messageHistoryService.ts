import { col, DataTypes, fn, Op } from "sequelize";
import { MessageHistory, MessageHistoryAttributes } from "@/database/models";
import { sequelize } from "@/database/sequelize";

class MessageHistoryService {
  private schemaReady = false;

  private async ensureColumns(): Promise<void> {
    if (this.schemaReady) return;
    const queryInterface = sequelize.getQueryInterface();
    const tableDefinition = await queryInterface.describeTable("MessageHistories");
    if (!tableDefinition["messageID"]) {
      await queryInterface.addColumn("MessageHistories", "messageID", {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "",
      });
    }
    this.schemaReady = true;
  }

  async createMessageHistory(
    data: MessageHistoryAttributes,
  ): Promise<MessageHistory> {
    await this.ensureColumns();
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

  async getLatestByUserInChannel(guildID: string, userID: string, channelID: string): Promise<MessageHistory | null> {
    await this.ensureColumns();
    return await MessageHistory.findOne({
      where: { guildID, userID, channelID },
      order: [["date", "DESC"]],
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
