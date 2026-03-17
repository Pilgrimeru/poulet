import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

export interface GuildSettingsAttributes {
  guildID: string;
  statsBlacklistChannelIDs: string;
  statsCountDeafTime: boolean;
  statsAutoFrequency: "disabled" | "daily" | "weekly" | "monthly";
  statsRankingPreference: "voice" | "messages";
  statsReportChannelID: string;
  emoteChannelID: string;
}

class GuildSettings extends Model<GuildSettingsAttributes> {
  declare guildID: string;
  declare statsBlacklistChannelIDs: string;
  declare statsCountDeafTime: boolean;
  declare statsAutoFrequency: "disabled" | "daily" | "weekly" | "monthly";
  declare statsRankingPreference: "voice" | "messages";
  declare statsReportChannelID: string;
  declare emoteChannelID: string;
}

GuildSettings.init(
  {
    guildID: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    statsBlacklistChannelIDs: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "[]",
    },
    statsCountDeafTime: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    statsAutoFrequency: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "monthly",
    },
    statsRankingPreference: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "messages",
    },
    statsReportChannelID: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "",
    },
    emoteChannelID: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "",
    },
  },
  {
    sequelize,
    modelName: "GuildSettings",
    timestamps: false,
  },
);

export { GuildSettings };
