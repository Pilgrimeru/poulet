import { apiGet, apiPatch } from "./client";

export type GuildSettingsDTO = {
  guildID: string;
  statsBlacklistChannelIDs: string[];
  statsCountDeafTime: boolean;
  statsAutoFrequency: "disabled" | "daily" | "weekly" | "monthly";
  statsRankingPreference: "voice" | "messages";
  statsReportChannelID: string;
  emoteChannelID: string;
};

export const guildSettingsService = {
  async getByGuildID(guildID: string): Promise<GuildSettingsDTO> {
    return apiGet(`/guilds/${guildID}/settings`);
  },

  async updateByGuildID(
    guildID: string,
    patch: Partial<Omit<GuildSettingsDTO, "guildID">>,
  ): Promise<GuildSettingsDTO> {
    return apiPatch(`/guilds/${guildID}/settings`, patch);
  },
};
