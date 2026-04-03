export type GuildSettingsDTO = {
  guildID: string;
  statsBlacklistChannelIDs: string[];
  statsCountDeafTime: boolean;
  statsAutoFrequency: "disabled" | "daily" | "weekly" | "monthly";
  statsRankingPreference: "voice" | "messages";
  statsReportChannelID: string;
  inviteLogChannelID: string;
  sanctionDurationMs: number | null;
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

export type SettingsSection = "stats" | "spam" | "invite-log";
