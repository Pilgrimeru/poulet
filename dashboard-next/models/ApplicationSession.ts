import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

export interface ApplicationSessionAttributes {
  id?: string;
  formID: string;
  guildID: string;
  userID: string;
  currentStep: number;
  answers: string;
  expiresAt: number;
  createdAt: number;
}

class ApplicationSession extends Model<ApplicationSessionAttributes> {
  declare id: string;
  declare formID: string;
  declare guildID: string;
  declare userID: string;
  declare currentStep: number;
  declare answers: string;
  declare expiresAt: number;
  declare createdAt: number;
}

ApplicationSession.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    formID: { type: DataTypes.UUID, allowNull: false },
    guildID: { type: DataTypes.STRING, allowNull: false },
    userID: { type: DataTypes.STRING, allowNull: false },
    currentStep: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    answers: { type: DataTypes.TEXT, allowNull: false, defaultValue: "{}" },
    expiresAt: { type: DataTypes.BIGINT, allowNull: false },
    createdAt: { type: DataTypes.BIGINT, allowNull: false },
  },
  {
    sequelize,
    modelName: "ApplicationSession",
    timestamps: false,
    indexes: [
      { fields: ["formID", "userID"], unique: true },
      { fields: ["expiresAt"] },
    ],
  },
);

export { ApplicationSession };
