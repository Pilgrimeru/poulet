import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

export interface MessageSnapshotAttributes {
  id?: string; // UUID
  messageID: string;
  channelID: string;
  guildID: string;
  authorID: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarURL: string;
  content: string;
  createdAt: number; // original message creation timestamp
  snapshotAt: number; // when this version was captured
  isDeleted: boolean;
  version: number; // 0 = original, 1+ = edits
}

class MessageSnapshot extends Model<MessageSnapshotAttributes> {
  declare id: string;
  declare messageID: string;
  declare channelID: string;
  declare guildID: string;
  declare authorID: string;
  declare authorUsername: string;
  declare authorDisplayName: string;
  declare authorAvatarURL: string;
  declare content: string;
  declare createdAt: number;
  declare snapshotAt: number;
  declare isDeleted: boolean;
  declare version: number;
}

MessageSnapshot.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    messageID: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    channelID: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    guildID: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    authorID: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    authorUsername: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "",
    },
    authorDisplayName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "",
    },
    authorAvatarURL: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "",
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
    },
    createdAt: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    snapshotAt: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    modelName: "MessageSnapshot",
    timestamps: false,
    indexes: [
      { fields: ["messageID"] },
      { fields: ["guildID", "channelID", "snapshotAt"] },
      { fields: ["authorID"] },
      { fields: ["isDeleted"] },
    ],
  },
);

export { MessageSnapshot };
