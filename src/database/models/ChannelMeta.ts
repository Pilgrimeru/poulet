import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

export interface ChannelMetaAttributes {
  channelID: string;
  guildID: string;
  name: string;
}

class ChannelMeta extends Model<ChannelMetaAttributes> {
  declare channelID: string;
  declare guildID: string;
  declare name: string;
}

ChannelMeta.init(
  {
    channelID: { type: DataTypes.STRING, primaryKey: true },
    guildID: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
  },
  {
    sequelize,
    modelName: "ChannelMeta",
    timestamps: false,
  },
);

export { ChannelMeta };
