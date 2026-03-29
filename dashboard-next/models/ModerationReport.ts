import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

export interface ModerationReportAttributes {
  id?: string;
  guildID: string;
  reporterID: string;
  targetUserID: string;
  ticketChannelID: string;
  status: string;
  reporterSummary: string;
  aiQuestions?: string | null;
  aiQQOQCCP?: string | null;
  confirmationCount: number;
  warnID?: string | null;
  sanctionID?: string | null;
  appealText?: string | null;
  appealStatus?: string | null;
  appealAt?: number | null;
  moderatorID?: string | null;
  createdAt: number;
}

class ModerationReport extends Model<ModerationReportAttributes> {
  declare id: string;
  declare guildID: string;
  declare reporterID: string;
  declare targetUserID: string;
  declare ticketChannelID: string;
  declare status: string;
  declare reporterSummary: string;
  declare aiQuestions: string | null;
  declare aiQQOQCCP: string | null;
  declare confirmationCount: number;
  declare warnID: string | null;
  declare sanctionID: string | null;
  declare appealText: string | null;
  declare appealStatus: string | null;
  declare appealAt: number | null;
  declare moderatorID: string | null;
  declare createdAt: number;
}

ModerationReport.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    guildID: { type: DataTypes.STRING, allowNull: false },
    reporterID: { type: DataTypes.STRING, allowNull: false },
    targetUserID: { type: DataTypes.STRING, allowNull: false },
    ticketChannelID: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "awaiting_ai" },
    reporterSummary: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    aiQuestions: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    aiQQOQCCP: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    confirmationCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
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
    modelName: "ModerationReport",
    timestamps: false,
    indexes: [
      { fields: ["guildID", "status"] },
      { fields: ["ticketChannelID"] },
      { fields: ["appealStatus"] },
      { fields: ["targetUserID"] },
    ],
  },
);

export { ModerationReport };
