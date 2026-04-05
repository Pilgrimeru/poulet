import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

class MemberInvite extends Model {
  declare guildID: string;
  declare userID: string;
  declare inviterID: string;
  declare inviterTag: string;
  declare code: string;
}

MemberInvite.init(
  {
    guildID: { type: DataTypes.STRING, allowNull: false },
    userID: { type: DataTypes.STRING, allowNull: false },
    inviterID: { type: DataTypes.STRING, allowNull: false },
    inviterTag: { type: DataTypes.STRING, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: false },
  },
  {
    sequelize,
    modelName: "MemberInvite",
    timestamps: false,
    indexes: [
      { name: "idx_member_invite_guild_user", unique: true, fields: ["guildID", "userID"] },
    ],
  },
);

export { MemberInvite };
