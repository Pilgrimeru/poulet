import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
import { PollAttributes } from "@/database/types";

class Poll extends Model<PollAttributes> implements PollAttributes {
  declare pollId: string;
  declare title: string;
  declare messagePath: string;
  declare expiration: number;
  declare allowMultipleChoice: boolean;
  declare options: string;
  declare isClosed?: boolean;
}

Poll.init(
  {
    pollId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    messagePath: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    expiration: {
      type: DataTypes.BIGINT,
      allowNull: false,
      validate: {
        isInt: true,
      },
    },
    allowMultipleChoice: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    options: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    isClosed: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: "Poll",
    timestamps: false,
  },
);

export { Poll };
