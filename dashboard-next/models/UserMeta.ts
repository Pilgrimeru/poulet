import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

class UserMeta extends Model {
  declare userID: string;
  declare guildID: string;
  declare username: string;
  declare displayName: string;
  declare avatarURL: string;
  declare isDeleted: boolean;
  declare updatedAt: number;
}

UserMeta.init(
  {
    userID: { type: DataTypes.STRING, primaryKey: true },
    guildID: { type: DataTypes.STRING, primaryKey: true },
    username: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
    displayName: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
    avatarURL: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
    isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    updatedAt: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: "UserMeta",
    timestamps: false,
    indexes: [{ fields: ["guildID"] }],
  },
);

export { UserMeta };
