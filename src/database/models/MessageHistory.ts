import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

export interface MessageHistoryAttributes {
  userID: string;
  date: number;
  channelID: string;
  guildID: string;
  messageID: string;
}

class MessageHistory extends Model<MessageHistoryAttributes> {
  declare userID: string;
  declare date: number;
  declare channelID: string;
  declare guildID: string;
  declare messageID: string;
}

MessageHistory.init(
  {
    userID: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    date: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    channelID: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    guildID: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    messageID: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "",
    },
  },
  {
    sequelize,
    modelName: "MessageHistory",
    timestamps: false,
    indexes: [
      {
        name: "idx_message_history_guildID_date",
        fields: ["guildID", "date"],
      },
    ],
  },
);

export { MessageHistory };
