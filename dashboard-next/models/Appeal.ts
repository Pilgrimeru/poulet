import { DataTypes, Model, NonAttribute } from "sequelize";
import { sequelize } from "../lib/db";
import type { Sanction } from "./Sanction";

export type AppealStatus = "pending_review" | "upheld" | "overturned";

export interface AppealAttributes {
  id?: string;
  sanctionID: string;
  text: string;
  status: AppealStatus;
  reviewOutcome?: "upheld" | "overturned" | "modified" | "sanctioned_bad_faith" | null;
  resolutionReason?: string | null;
  revisedSanction?: string | null;
  reviewedAt?: number | null;
  createdAt: number;
}

class Appeal extends Model<AppealAttributes> {
  declare id: string;
  declare sanctionID: string;
  declare text: string;
  declare status: AppealStatus;
  declare reviewOutcome: "upheld" | "overturned" | "modified" | "sanctioned_bad_faith" | null;
  declare resolutionReason: string | null;
  declare revisedSanction: string | null;
  declare reviewedAt: number | null;
  declare createdAt: number;
  declare sanction?: NonAttribute<Sanction>;
}

Appeal.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sanctionID: { type: DataTypes.UUID, allowNull: false },
    text: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "pending_review" },
    reviewOutcome: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    resolutionReason: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    revisedSanction: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    reviewedAt: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
    createdAt: { type: DataTypes.BIGINT, allowNull: false },
  },
  {
    sequelize,
    modelName: "Appeal",
    timestamps: false,
    indexes: [
      { fields: ["sanctionID"] },
      { fields: ["status"] },
    ],
  },
);

export { Appeal };
