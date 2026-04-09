import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

/**
 * A trigger group: all conditions within a group must match (AND logic).
 * Multiple groups are OR'd together.
 *
 * Example: (keywords:["hello"] AND hasAttachment:true) OR (regex:"good morning")
 */
export interface TriggerGroup {
  /** Words to look for in the message content */
  keywords: string[];
  /** "any" = at least one keyword matches (OR), "all" = every keyword must match (AND) */
  keywordMode: "any" | "all";
  /** Regex pattern to test against message content (null = ignored) */
  regex: string | null;
  /** true = must have attachment, false = must NOT have attachment, null = ignored */
  hasAttachment: boolean | null;
}

export interface AutoResponseAttributes {
  id: string;
  guildID: string;
  name: string;
  enabled: boolean;
  /** JSON: TriggerGroup[] */
  triggerGroups: string;
  /** "all" | "whitelist" | "blacklist" */
  channelMode: string;
  /** JSON: string[] */
  channelIDs: string;
  /** JSON: string[] — emojis to react with */
  responseEmojis: string;
  /** Message to send, or null */
  responseMessage: string | null;
  /** Whether to reply to the triggering message (true) or send standalone (false) */
  responseReply: boolean;
}

class AutoResponse extends Model<AutoResponseAttributes> {
  declare id: string;
  declare guildID: string;
  declare name: string;
  declare enabled: boolean;
  declare triggerGroups: string;
  declare channelMode: string;
  declare channelIDs: string;
  declare responseEmojis: string;
  declare responseMessage: string | null;
  declare responseReply: boolean;
}

AutoResponse.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    guildID: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false, defaultValue: "Nouvelle règle" },
    enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    triggerGroups: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" },
    channelMode: { type: DataTypes.STRING, allowNull: false, defaultValue: "all" },
    channelIDs: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" },
    responseEmojis: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" },
    responseMessage: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    responseReply: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    modelName: "AutoResponse",
    timestamps: false,
    indexes: [{ name: "idx_auto_response_guildID", fields: ["guildID"] }],
  },
);

export { AutoResponse };
