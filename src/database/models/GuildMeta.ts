import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

export interface GuildMetaAttributes {
  guildID: string;
  name: string;
  iconURL: string;
}

class GuildMeta extends Model<GuildMetaAttributes> {
  declare guildID: string;
  declare name: string;
  declare iconURL: string;
}

GuildMeta.init(
  {
    guildID: { type: DataTypes.STRING, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
    iconURL: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
  },
  {
    sequelize,
    modelName: "GuildMeta",
    timestamps: false,
  },
);

export { GuildMeta };
