import { GuildSettings } from "../models/GuildSettings";
import { sequelize } from "../lib/db";
import { DataTypes } from "sequelize";

export type GuildSettingsDTO = {
  guildID: string;
  statsBlacklistChannelIDs: string[];
  statsCountDeafTime: boolean;
  statsAutoFrequency: "disabled" | "daily" | "weekly" | "monthly";
  statsRankingPreference: "voice" | "messages";
  statsReportChannelID: string;
  emoteChannelID: string;
  inviteLogChannelID: string;
  sanctionDurationMs: number | null;
  moderationNotifChannelID: string;
  moderationModRoleID: string;
  reportDailyLimit: number;
  starboardChannelID: string;
  starboardEmoji: string;
  starboardThreshold: number;
};

const cache = new Map<string, GuildSettingsDTO>();
let schemaReady = false;

function parseList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((e) => typeof e === "string") : [];
  } catch {
    return [];
  }
}

async function ensureColumns(): Promise<void> {
  if (schemaReady) return;
  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable("GuildSettings");
  const cols = [
    { name: "statsBlacklistChannelIDs", type: DataTypes.TEXT, defaultValue: "[]" },
    { name: "statsCountDeafTime", type: DataTypes.BOOLEAN, defaultValue: false },
    { name: "statsAutoFrequency", type: DataTypes.STRING, defaultValue: "disabled" },
    { name: "statsRankingPreference", type: DataTypes.STRING, defaultValue: "messages" },
    { name: "statsReportChannelID", type: DataTypes.STRING, defaultValue: "" },
    { name: "emoteChannelID", type: DataTypes.STRING, defaultValue: "" },
    { name: "inviteLogChannelID", type: DataTypes.STRING, defaultValue: "" },
    { name: "sanctionDurationMs", type: DataTypes.BIGINT, defaultValue: null, allowNull: true },
    { name: "moderationNotifChannelID", type: DataTypes.STRING, defaultValue: "" },
    { name: "moderationModRoleID", type: DataTypes.STRING, defaultValue: "" },
    { name: "reportDailyLimit", type: DataTypes.INTEGER, defaultValue: 5 },
    { name: "starboardChannelID", type: DataTypes.STRING, defaultValue: "" },
    { name: "starboardEmoji", type: DataTypes.STRING, defaultValue: "⭐" },
    { name: "starboardThreshold", type: DataTypes.INTEGER, defaultValue: 5 },
  ];
  for (const col of cols) {
    if (!table[col.name]) {
      await qi.addColumn("GuildSettings", col.name, {
        type: col.type,
        allowNull: "allowNull" in col ? col.allowNull : false,
        defaultValue: col.defaultValue,
      });
    }
  }
  schemaReady = true;
}

async function loadOrCreate(guildID: string): Promise<GuildSettingsDTO> {
  await ensureColumns();
  const cached = cache.get(guildID);
  if (cached) return cached;

  let row = await GuildSettings.findByPk(guildID);
  if (!row) {
    row = await GuildSettings.create({
      guildID,
      statsBlacklistChannelIDs: "[]",
      statsCountDeafTime: false,
      statsAutoFrequency: "disabled",
      statsRankingPreference: "messages",
      statsReportChannelID: "",
      emoteChannelID: "",
      inviteLogChannelID: "",
      sanctionDurationMs: null,
      moderationNotifChannelID: "",
      moderationModRoleID: "",
      reportDailyLimit: 5,
      starboardChannelID: "",
      starboardEmoji: "⭐",
      starboardThreshold: 5,
    } as any);
  }

  const dto: GuildSettingsDTO = {
    guildID: row.guildID,
    statsBlacklistChannelIDs: parseList(row.statsBlacklistChannelIDs),
    statsCountDeafTime: row.statsCountDeafTime,
    statsAutoFrequency:
      ["daily", "weekly", "monthly", "disabled"].includes(row.statsAutoFrequency)
        ? (row.statsAutoFrequency as any)
        : "disabled",
    statsRankingPreference:
      row.statsRankingPreference === "voice" || row.statsRankingPreference === "messages"
        ? row.statsRankingPreference
        : "messages",
    statsReportChannelID: row.statsReportChannelID,
    emoteChannelID: row.emoteChannelID,
    inviteLogChannelID: row.inviteLogChannelID,
    sanctionDurationMs: row.sanctionDurationMs === null || row.sanctionDurationMs === undefined ? null : Number(row.sanctionDurationMs),
    moderationNotifChannelID: row.moderationNotifChannelID ?? "",
    moderationModRoleID: row.moderationModRoleID ?? "",
    reportDailyLimit: Math.max(1, Number(row.reportDailyLimit) || 5),
    starboardChannelID: row.starboardChannelID ?? "",
    starboardEmoji: row.starboardEmoji || "⭐",
    starboardThreshold: Number(row.starboardThreshold) || 5,
  };

  cache.set(guildID, dto);
  return dto;
}

export async function getByGuildID(guildID: string): Promise<GuildSettingsDTO> {
  return loadOrCreate(guildID);
}

export async function updateByGuildID(
  guildID: string,
  patch: Partial<Omit<GuildSettingsDTO, "guildID">>,
): Promise<GuildSettingsDTO> {
  const current = await loadOrCreate(guildID);
  const next: GuildSettingsDTO = {
    guildID,
    statsBlacklistChannelIDs: patch.statsBlacklistChannelIDs ?? current.statsBlacklistChannelIDs,
    statsCountDeafTime: patch.statsCountDeafTime ?? current.statsCountDeafTime,
    statsAutoFrequency: patch.statsAutoFrequency ?? current.statsAutoFrequency,
    statsRankingPreference: patch.statsRankingPreference ?? current.statsRankingPreference,
    statsReportChannelID: patch.statsReportChannelID ?? current.statsReportChannelID,
    emoteChannelID: patch.emoteChannelID ?? current.emoteChannelID,
    inviteLogChannelID: patch.inviteLogChannelID ?? current.inviteLogChannelID,
    sanctionDurationMs: patch.sanctionDurationMs ?? current.sanctionDurationMs,
    moderationNotifChannelID: patch.moderationNotifChannelID ?? current.moderationNotifChannelID,
    moderationModRoleID: patch.moderationModRoleID ?? current.moderationModRoleID,
    reportDailyLimit:
      patch.reportDailyLimit === undefined
        ? current.reportDailyLimit
        : Math.max(1, Number(patch.reportDailyLimit) || 1),
    starboardChannelID: patch.starboardChannelID ?? current.starboardChannelID,
    starboardEmoji: patch.starboardEmoji ?? current.starboardEmoji,
    starboardThreshold: patch.starboardThreshold ?? current.starboardThreshold,
  };

  await GuildSettings.upsert({
    guildID,
    statsBlacklistChannelIDs: JSON.stringify(next.statsBlacklistChannelIDs),
    statsCountDeafTime: next.statsCountDeafTime,
    statsAutoFrequency: next.statsAutoFrequency,
    statsRankingPreference: next.statsRankingPreference,
    statsReportChannelID: next.statsReportChannelID,
    emoteChannelID: next.emoteChannelID,
    inviteLogChannelID: next.inviteLogChannelID,
    sanctionDurationMs: next.sanctionDurationMs,
    moderationNotifChannelID: next.moderationNotifChannelID,
    moderationModRoleID: next.moderationModRoleID,
    reportDailyLimit: next.reportDailyLimit,
    starboardChannelID: next.starboardChannelID,
    starboardEmoji: next.starboardEmoji,
    starboardThreshold: next.starboardThreshold,
  } as any);

  cache.set(guildID, next);
  return next;
}

export function invalidateCache(guildID: string): void {
  cache.delete(guildID);
}
