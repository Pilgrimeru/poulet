import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

class MemberEvent extends Model {
  declare guildID: string;
  declare userID: string;
  declare type: "join" | "leave";
  declare date: number;
}

MemberEvent.init(
  {
    guildID: { type: DataTypes.STRING, allowNull: false },
    userID: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: "MemberEvent",
    timestamps: false,
    indexes: [
      { name: "idx_member_event_guildID_date", unique: false, fields: ["guildID", "date"] },
    ],
  },
);

export { MemberEvent };
