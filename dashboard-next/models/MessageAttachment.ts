import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

export interface MessageAttachmentAttributes {
  id?: string;
  snapshotId: string;
  attachmentID: string;
  filename: string;
  url: string;
  contentType: string;
  size: number;
}

class MessageAttachment extends Model<MessageAttachmentAttributes> {
  declare id: string;
  declare snapshotId: string;
  declare attachmentID: string;
  declare filename: string;
  declare url: string;
  declare contentType: string;
  declare size: number;
}

MessageAttachment.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    snapshotId: { type: DataTypes.UUID, allowNull: false },
    attachmentID: { type: DataTypes.STRING, allowNull: false },
    filename: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
    url: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    contentType: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
    size: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: "MessageAttachment",
    timestamps: false,
    indexes: [{ fields: ["snapshotId"] }],
  },
);

export { MessageAttachment };
