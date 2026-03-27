import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

class StatsReportMessageState extends Model {
  declare guildID: string;
  declare messageID: string;
}

StatsReportMessageState.init(
  {
    guildID: { type: DataTypes.STRING, primaryKey: true },
    messageID: { type: DataTypes.STRING, allowNull: false },
  },
  { sequelize, modelName: "StatsReportMessageState", timestamps: false },
);

export { StatsReportMessageState };
