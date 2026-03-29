import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

export interface FlaggedMessageAttributes {
  id?: string;
  guildID: string;
  channelID: string;
  messageID: string;
  reporterID: string;
  targetUserID: string;
  status: string;
  aiAnalysis?: string | null;
  warnID?: string | null;
  sanctionID?: string | null;
  appealText?: string | null;
  appealStatus?: string | null;
  appealAt?: number | null;
  moderatorID?: string | null;
  createdAt: number;
}

class FlaggedMessage extends Model<FlaggedMessageAttributes> {
  declare id: string;
  declare guildID: string;
  declare channelID: string;
  declare messageID: string;
  declare reporterID: string;
  declare targetUserID: string;
  declare status: string;
  declare aiAnalysis: string | null;
  declare warnID: string | null;
  declare sanctionID: string | null;
  declare appealText: string | null;
  declare appealStatus: string | null;
  declare appealAt: number | null;
  declare moderatorID: string | null;
  declare createdAt: number;
}

FlaggedMessage.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    guildID: { type: DataTypes.STRING, allowNull: false },
    channelID: { type: DataTypes.STRING, allowNull: false },
    messageID: { type: DataTypes.STRING, allowNull: false },
    reporterID: { type: DataTypes.STRING, allowNull: false },
    targetUserID: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "pending" },
    aiAnalysis: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    warnID: { type: DataTypes.UUID, allowNull: true, defaultValue: null },
    sanctionID: { type: DataTypes.UUID, allowNull: true, defaultValue: null },
    appealText: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    appealStatus: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    appealAt: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
    moderatorID: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    createdAt: { type: DataTypes.BIGINT, allowNull: false },
  },
  {
    sequelize,
    modelName: "FlaggedMessage",
    timestamps: false,
    indexes: [
      { fields: ["guildID", "status"] },
      { fields: ["guildID", "targetUserID"] },
      { fields: ["appealStatus"] },
      { fields: ["messageID"] },
    ],
  },
);

export { FlaggedMessage };
