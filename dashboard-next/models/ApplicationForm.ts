import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

export type QuestionType = "open_text" | "single_choice" | "multiple_choice";

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  minValues?: number;
  maxValues?: number;
  placeholder?: string;
}

export interface ApplicationFormAttributes {
  id?: string;
  guildID: string;
  name: string;
  description: string;
  questions: string;
  acceptRoleIDs: string;
  removeRoleIDs: string;
  rejectRoleIDs: string;
  welcomeChannelID: string | null;
  welcomeMessageID: string | null;
  submissionChannelID: string | null;
  cooldownMs: number;
  sessionTimeoutMs: number;
  isActive: boolean;
  createdAt: number;
}

class ApplicationForm extends Model<ApplicationFormAttributes> {
  declare id: string;
  declare guildID: string;
  declare name: string;
  declare description: string;
  declare questions: string;
  declare acceptRoleIDs: string;
  declare removeRoleIDs: string;
  declare rejectRoleIDs: string;
  declare welcomeChannelID: string | null;
  declare welcomeMessageID: string | null;
  declare submissionChannelID: string | null;
  declare cooldownMs: number;
  declare sessionTimeoutMs: number;
  declare isActive: boolean;
  declare createdAt: number;
}

ApplicationForm.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    guildID: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    questions: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" },
    acceptRoleIDs: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" },
    removeRoleIDs: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" },
    rejectRoleIDs: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" },
    welcomeChannelID: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    welcomeMessageID: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    submissionChannelID: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    cooldownMs: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    sessionTimeoutMs: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 900_000 },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdAt: { type: DataTypes.BIGINT, allowNull: false },
  },
  {
    sequelize,
    modelName: "ApplicationForm",
    timestamps: false,
    indexes: [
      { fields: ["guildID"] },
      { fields: ["guildID", "welcomeChannelID"] },
    ],
  },
);

export { ApplicationForm };
