import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

class SpamFilterRule extends Model {
  declare id: string;
  declare guildID: string;
  declare name: string;
  declare description: string;
  declare mode: string;
  declare channelIDs: string;
  declare messageLimit: number;
  declare intervalInSec: number;
  declare punishmentDurationInSec: number;
  declare enabled: boolean;
}

SpamFilterRule.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    guildID: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
    mode: { type: DataTypes.STRING, allowNull: false, defaultValue: "blacklist" },
    channelIDs: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" },
    messageLimit: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    intervalInSec: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    punishmentDurationInSec: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 300 },
    enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    modelName: "SpamFilterRule",
    timestamps: false,
    indexes: [{ name: "idx_spam_filter_rule_guildID", fields: ["guildID"] }],
  },
);

export { SpamFilterRule };
