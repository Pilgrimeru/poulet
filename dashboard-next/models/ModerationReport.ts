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
  confirmationCount: number;
  sanctionID?: string | null;
  context?: string | null;
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
  declare confirmationCount: number;
  declare sanctionID: string | null;
  declare context: string | null;
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
    confirmationCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    sanctionID: { type: DataTypes.UUID, allowNull: true, defaultValue: null },
    context: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
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
      { fields: ["targetUserID"] },
    ],
  },
);

export { ModerationReport };
