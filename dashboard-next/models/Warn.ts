import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

export type WarnSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface WarnAttributes {
  id?: string;
  guildID: string;
  userID: string;
  moderatorID: string;
  reason: string;
  severity: WarnSeverity;
  isActive: boolean;
  createdAt: number;
  expiresAt?: number | null;
}

class Warn extends Model<WarnAttributes> {
  declare id: string;
  declare guildID: string;
  declare userID: string;
  declare moderatorID: string;
  declare reason: string;
  declare severity: WarnSeverity;
  declare isActive: boolean;
  declare createdAt: number;
  declare expiresAt: number | null;
}

Warn.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    guildID: { type: DataTypes.STRING, allowNull: false },
    userID: { type: DataTypes.STRING, allowNull: false },
    moderatorID: { type: DataTypes.STRING, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    severity: { type: DataTypes.STRING, allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdAt: { type: DataTypes.BIGINT, allowNull: false },
    expiresAt: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
  },
  {
    sequelize,
    modelName: "Warn",
    timestamps: false,
    indexes: [
      { fields: ["guildID", "userID"] },
      { fields: ["guildID", "isActive"] },
      { fields: ["createdAt"] },
    ],
  },
);

export { Warn };
