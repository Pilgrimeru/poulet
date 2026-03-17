import { GuildSettings } from "@/database/models";
import { sequelize } from "@/database/sequelize";
import { DataTypes } from "sequelize";

export type GuildSettingsDTO = {
  guildID: string;
  statsBlacklistChannelIDs: string[];
  statsCountDeafTime: boolean;
  statsAutoFrequency: "disabled" | "daily" | "weekly" | "monthly";
  statsRankingPreference: "voice" | "messages";
  statsReportChannelID: string;
  emoteChannelID: string;
};

class GuildSettingsService {
  private readonly cache = new Map<string, GuildSettingsDTO>();
  private schemaReady = false;

  private serializeList(value: string[]): string {
    return JSON.stringify(value);
  }

  private parseList(value: string): string[] {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((entry) => typeof entry === "string")
        : [];
    } catch {
      return [];
    }
  }

  private async ensureColumns(): Promise<void> {
    if (this.schemaReady) return;
    const queryInterface = sequelize.getQueryInterface();
    const tableDefinition = await queryInterface.describeTable("GuildSettings");

    const columnsToAdd: Array<{ name: string; type: any; defaultValue: any }> = [
      { name: "statsBlacklistChannelIDs", type: DataTypes.TEXT, defaultValue: "[]" },
      { name: "statsCountDeafTime", type: DataTypes.BOOLEAN, defaultValue: false },
      { name: "statsAutoFrequency", type: DataTypes.STRING, defaultValue: "disabled" },
      { name: "statsRankingPreference", type: DataTypes.STRING, defaultValue: "messages" },
      { name: "statsReportChannelID", type: DataTypes.STRING, defaultValue: "" },
      { name: "emoteChannelID", type: DataTypes.STRING, defaultValue: "" },
    ];

    for (const column of columnsToAdd) {
      if (!tableDefinition[column.name]) {
        await queryInterface.addColumn("GuildSettings", column.name, {
          type: column.type,
          allowNull: false,
          defaultValue: column.defaultValue,
        });
      }
    }
    this.schemaReady = true;
  }

  private async loadOrCreate(guildID: string): Promise<GuildSettingsDTO> {
    await this.ensureColumns();
    const cached = this.cache.get(guildID);
    if (cached) return cached;

    let row = await GuildSettings.findByPk(guildID);
    if (!row) {
      row = await GuildSettings.create({
        guildID,
        statsBlacklistChannelIDs: this.serializeList([]),
        statsCountDeafTime: false,
        statsAutoFrequency: "disabled",
        statsRankingPreference: "messages",
        statsReportChannelID: "",
        emoteChannelID: "",
      });
    }

    const dto: GuildSettingsDTO = {
      guildID: row.guildID,
      statsBlacklistChannelIDs: this.parseList(row.statsBlacklistChannelIDs),
      statsCountDeafTime: row.statsCountDeafTime,
      statsAutoFrequency:
        row.statsAutoFrequency === "daily" ||
        row.statsAutoFrequency === "weekly" ||
        row.statsAutoFrequency === "monthly" ||
        row.statsAutoFrequency === "disabled"
          ? row.statsAutoFrequency
          : "monthly",
      statsRankingPreference:
        row.statsRankingPreference === "messages" ||
        row.statsRankingPreference === "voice"
          ? row.statsRankingPreference
          : "voice",
      statsReportChannelID: row.statsReportChannelID,
      emoteChannelID: row.emoteChannelID,
    };

    this.cache.set(guildID, dto);
    return dto;
  }

  async getByGuildID(guildID: string): Promise<GuildSettingsDTO> {
    return this.loadOrCreate(guildID);
  }

  async updateByGuildID(
    guildID: string,
    patch: Partial<Omit<GuildSettingsDTO, "guildID">>,
  ): Promise<GuildSettingsDTO> {
    const current = await this.loadOrCreate(guildID);
    const next: GuildSettingsDTO = {
      guildID,
      statsBlacklistChannelIDs:
        patch.statsBlacklistChannelIDs ?? current.statsBlacklistChannelIDs,
      statsCountDeafTime:
        patch.statsCountDeafTime ?? current.statsCountDeafTime,
      statsAutoFrequency:
        patch.statsAutoFrequency ?? current.statsAutoFrequency,
      statsRankingPreference:
        patch.statsRankingPreference ?? current.statsRankingPreference,
      statsReportChannelID:
        patch.statsReportChannelID ?? current.statsReportChannelID,
      emoteChannelID: patch.emoteChannelID ?? current.emoteChannelID,
    };

    await GuildSettings.upsert({
      guildID,
      statsBlacklistChannelIDs: this.serializeList(next.statsBlacklistChannelIDs),
      statsCountDeafTime: next.statsCountDeafTime,
      statsAutoFrequency: next.statsAutoFrequency,
      statsRankingPreference: next.statsRankingPreference,
      statsReportChannelID: next.statsReportChannelID,
      emoteChannelID: next.emoteChannelID,
    });

    this.cache.set(guildID, next);
    return next;
  }
}

export const guildSettingsService = new GuildSettingsService();
