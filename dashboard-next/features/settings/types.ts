export type GuildSettingsDTO = {
  guildID: string;
  statsBlacklistChannelIDs: string[];
  statsCountDeafTime: boolean;
  statsAutoFrequency: "disabled" | "daily" | "weekly" | "monthly";
  statsRankingPreference: "voice" | "messages";
  statsReportChannelID: string;
  inviteLogChannelID: string;
  sanctionDurationMs: number | null;
  moderationNotifChannelID: string;
  moderationModRoleID: string;
  reportDailyLimit: number;
  starboardChannelID: string;
  starboardEmoji: string;
  starboardThreshold: number;
};

export type SpamFilterMode = "whitelist" | "blacklist";

export type SpamRuleDTO = {
  id: string;
  guildID: string;
  name: string;
  description: string;
  mode: SpamFilterMode;
  channelIDs: string[];
  messageLimit: number;
  intervalInSec: number;
  punishmentDurationInSec: number;
  enabled: boolean;
};

export type ChannelRuleDTO = {
  id: string;
  guildID: string;
  channelID: string;
  autoThread: boolean;
  oneMessageLimit: boolean;
};

export type TriggerGroup = {
  keywords: string[];
  keywordMode: "any" | "all";
  regex: string | null;
  hasAttachment: boolean | null;
};

export type ChannelMode = "all" | "whitelist" | "blacklist";

export type AutoResponseDTO = {
  id: string;
  guildID: string;
  name: string;
  enabled: boolean;
  triggerGroups: TriggerGroup[];
  channelMode: ChannelMode;
  channelIDs: string[];
  responseEmojis: string[];
  responseMessage: string | null;
  responseReply: boolean;
};

export type SettingsSection = "stats" | "spam" | "invite-log" | "moderation" | "starboard" | "channels" | "auto-responses";
