import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

class GuildSettings extends Model {
  declare guildID: string;
  declare statsBlacklistChannelIDs: string;
  declare statsCountDeafTime: boolean;
  declare statsAutoFrequency: string;
  declare statsRankingPreference: string;
  declare statsReportChannelID: string;
  declare emoteChannelID: string;
}

GuildSettings.init(
  {
    guildID: { type: DataTypes.STRING, primaryKey: true },
    statsBlacklistChannelIDs: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" },
    statsCountDeafTime: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    statsAutoFrequency: { type: DataTypes.STRING, allowNull: false, defaultValue: "disabled" },
    statsRankingPreference: { type: DataTypes.STRING, allowNull: false, defaultValue: "messages" },
    statsReportChannelID: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
    emoteChannelID: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
  },
  { sequelize, modelName: "GuildSettings", timestamps: false },
);

export { GuildSettings };
