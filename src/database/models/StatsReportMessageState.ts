import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

export interface StatsReportMessageStateAttributes {
  guildID: string;
  messageID: string;
}

class StatsReportMessageState extends Model<StatsReportMessageStateAttributes> {
  declare guildID: string;
  declare messageID: string;
}

StatsReportMessageState.init(
  {
    guildID: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    messageID: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "StatsReportMessageState",
    timestamps: false,
  },
);

export { StatsReportMessageState };
