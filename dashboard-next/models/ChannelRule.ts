import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

export interface ChannelRuleAttributes {
  id: string;
  guildID: string;
  channelID: string;
  autoThread: boolean;
  oneMessageLimit: boolean;
}

class ChannelRule extends Model<ChannelRuleAttributes> {
  declare id: string;
  declare guildID: string;
  declare channelID: string;
  declare autoThread: boolean;
  declare oneMessageLimit: boolean;
}

ChannelRule.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    guildID: { type: DataTypes.STRING, allowNull: false },
    channelID: { type: DataTypes.STRING, allowNull: false },
    autoThread: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    oneMessageLimit: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { sequelize, modelName: "ChannelRule", timestamps: false },
);

export { ChannelRule };
