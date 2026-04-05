import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

class GuildSettings extends Model {
  declare guildID: string;
  declare statsBlacklistChannelIDs: string;
  declare statsCountDeafTime: boolean;
  declare statsAutoFrequency: string;
  declare statsRankingPreference: string;
  declare statsReportChannelID: string;
  declare emoteChannelID: string;
  declare inviteLogChannelID: string;
  declare sanctionDurationMs: number | null;
  declare moderationNotifChannelID: string;
  declare moderationModRoleID: string;
  declare starboardChannelID: string;
  declare starboardEmoji: string;
  declare starboardThreshold: number;
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
    inviteLogChannelID: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
    sanctionDurationMs: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
    moderationNotifChannelID: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
    moderationModRoleID: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
    starboardChannelID: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
    starboardEmoji: { type: DataTypes.STRING, allowNull: false, defaultValue: "⭐" },
    starboardThreshold: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
  },
  { sequelize, modelName: "GuildSettings", timestamps: false },
);

export { GuildSettings };
