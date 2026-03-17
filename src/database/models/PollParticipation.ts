import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
import { PollParticipationAttributes } from "@/database/types";
import { Poll } from "@/database/models";

class PollParticipation extends Model<PollParticipationAttributes> {
  declare pollId: string;
  declare userId: string;
  declare option: number;
}

PollParticipation.init(
  {
    pollId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
      references: {
        model: Poll,
        key: "pollId",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    userId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    option: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "PollParticipation",
    timestamps: false,
  },
);

export { PollParticipation };
