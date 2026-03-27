import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

class ChannelMeta extends Model {
  declare channelID: string;
  declare guildID: string;
  declare name: string;
  declare parentID: string | null;
  declare parentName: string | null;
  declare channelType: number | null;
}

ChannelMeta.init(
  {
    channelID: { type: DataTypes.STRING, primaryKey: true },
    guildID: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
    parentID: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    parentName: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    channelType: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
  },
  {
    sequelize,
    modelName: "ChannelMeta",
    timestamps: false,
  },
);

export { ChannelMeta };
