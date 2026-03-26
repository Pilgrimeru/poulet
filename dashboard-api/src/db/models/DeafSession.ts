import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

export interface SessionAttributes {
  guildID: string;
  userID: string;
  channelID: string;
  start: number;
  end: number;
}

class DeafSession extends Model<SessionAttributes> {
  declare guildID: string;
  declare userID: string;
  declare channelID: string;
  declare start: number;
  declare end: number;
}

DeafSession.init(
  {
    guildID: { type: DataTypes.STRING, allowNull: false },
    userID: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
    channelID: { type: DataTypes.STRING, allowNull: false },
    start: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
    end: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: "DeafSession",
    timestamps: false,
    indexes: [{ name: "idx_deaf_start_end_guildID", unique: false, fields: ["start", "end", "guildID"] }],
  },
);

export { DeafSession };
