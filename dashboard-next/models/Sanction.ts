import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

export type SanctionType = "MUTE" | "BAN_PENDING";

export interface SanctionAttributes {
  id?: string;
  guildID: string;
  userID: string;
  moderatorID: string;
  type: SanctionType;
  reason: string;
  warnID?: string | null;
  isActive: boolean;
  durationMs?: number | null;
  createdAt: number;
  expiresAt?: number | null;
}

class Sanction extends Model<SanctionAttributes> {
  declare id: string;
  declare guildID: string;
  declare userID: string;
  declare moderatorID: string;
  declare type: SanctionType;
  declare reason: string;
  declare warnID: string | null;
  declare isActive: boolean;
  declare durationMs: number | null;
  declare createdAt: number;
  declare expiresAt: number | null;
}

Sanction.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    guildID: { type: DataTypes.STRING, allowNull: false },
    userID: { type: DataTypes.STRING, allowNull: false },
    moderatorID: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    warnID: { type: DataTypes.UUID, allowNull: true, defaultValue: null },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    durationMs: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
    createdAt: { type: DataTypes.BIGINT, allowNull: false },
    expiresAt: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
  },
  {
    sequelize,
    modelName: "Sanction",
    timestamps: false,
    indexes: [
      { fields: ["guildID", "userID"] },
      { fields: ["guildID", "isActive"] },
      { fields: ["warnID"] },
    ],
  },
);

export { Sanction };
