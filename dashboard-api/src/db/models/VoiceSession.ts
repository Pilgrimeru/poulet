import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

class VoiceSession extends Model {
  declare guildID: string;
  declare userID: string;
  declare channelID: string;
  declare start: number;
  declare end: number;
}

VoiceSession.init(
  {
    guildID: { type: DataTypes.STRING, allowNull: false },
    userID: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
    channelID: { type: DataTypes.STRING, allowNull: false },
    start: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
    end: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: "VoiceSession",
    timestamps: false,
    indexes: [{ name: "idx_voice_start_end_guildID", unique: false, fields: ["start", "end", "guildID"] }],
  },
);

export { VoiceSession };
