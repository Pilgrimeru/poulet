import { DataTypes, Model, NonAttribute } from "sequelize";
import { sequelize } from "../lib/db";
import type { Appeal } from "./Appeal";

export type SanctionType = "WARN" | "MUTE" | "BAN_PENDING";
export type SanctionSeverity = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "UNFORGIVABLE";
export type SanctionNature = "Extremism" | "Violence" | "Hate" | "Harassment" | "Spam" | "Manipulation" | "Recidivism" | "Other";
export type SanctionState = "created" | "canceled";

export interface SanctionAttributes {
  id?: string;
  guildID: string;
  userID: string;
  moderatorID: string;
  type: SanctionType;
  severity: SanctionSeverity;
  nature: SanctionNature;
  state: SanctionState;
  reason: string;
  durationMs?: number | null;
  createdAt: number;
}

class Sanction extends Model<SanctionAttributes> {
  declare id: string;
  declare guildID: string;
  declare userID: string;
  declare moderatorID: string;
  declare type: SanctionType;
  declare severity: SanctionSeverity;
  declare nature: SanctionNature;
  declare state: SanctionState;
  declare reason: string;
  declare durationMs: number | null;
  declare createdAt: number;
  declare appeals?: NonAttribute<Appeal[]>;
}

Sanction.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    guildID: { type: DataTypes.STRING, allowNull: false },
    userID: { type: DataTypes.STRING, allowNull: false },
    moderatorID: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    severity: { type: DataTypes.STRING, allowNull: false },
    nature: { type: DataTypes.STRING, allowNull: false },
    state: { type: DataTypes.STRING, allowNull: false, defaultValue: "created" },
    reason: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    durationMs: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
    createdAt: { type: DataTypes.BIGINT, allowNull: false },
  },
  {
    sequelize,
    modelName: "Sanction",
    timestamps: false,
    indexes: [
      { fields: ["guildID", "userID"] },
      { fields: ["guildID", "state"] },
      { fields: ["state", "nature"] },
    ],
  },
);

export { Sanction };
