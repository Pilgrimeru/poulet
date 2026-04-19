import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

export type SubmissionStatus = "pending" | "accepted" | "rejected";

export interface ApplicationSubmissionAttributes {
  id?: string;
  formID: string;
  guildID: string;
  userID: string;
  answers: string;
  status: SubmissionStatus;
  reviewerNotes: string | null;
  reviewedAt: number | null;
  reviewedByUserID: string | null;
  rolesApplied: boolean;
  createdAt: number;
}

class ApplicationSubmission extends Model<ApplicationSubmissionAttributes> {
  declare id: string;
  declare formID: string;
  declare guildID: string;
  declare userID: string;
  declare answers: string;
  declare status: SubmissionStatus;
  declare reviewerNotes: string | null;
  declare reviewedAt: number | null;
  declare reviewedByUserID: string | null;
  declare rolesApplied: boolean;
  declare createdAt: number;
}

ApplicationSubmission.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    formID: { type: DataTypes.UUID, allowNull: false },
    guildID: { type: DataTypes.STRING, allowNull: false },
    userID: { type: DataTypes.STRING, allowNull: false },
    answers: { type: DataTypes.TEXT, allowNull: false, defaultValue: "{}" },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "pending" },
    reviewerNotes: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    reviewedAt: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
    reviewedByUserID: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    rolesApplied: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    createdAt: { type: DataTypes.BIGINT, allowNull: false },
  },
  {
    sequelize,
    modelName: "ApplicationSubmission",
    timestamps: false,
    indexes: [
      { fields: ["formID"] },
      { fields: ["guildID"] },
      { fields: ["guildID", "userID"] },
      { fields: ["guildID", "rolesApplied", "status"] },
    ],
  },
);

export { ApplicationSubmission };
