import { apiGet, apiPatch } from "./client";
import { createTimedCache } from "./cache";

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

const settingsCache = createTimedCache<string, GuildSettingsDTO>(30_000);

export const guildSettingsService = {
  async getByGuildID(guildID: string): Promise<GuildSettingsDTO> {
    return settingsCache.getOrLoad(guildID, () => apiGet(`/guilds/${guildID}/settings`));
  },

  async updateByGuildID(
    guildID: string,
    patch: Partial<Omit<GuildSettingsDTO, "guildID">>,
  ): Promise<GuildSettingsDTO> {
    const updated = await apiPatch<GuildSettingsDTO>(`/guilds/${guildID}/settings`, patch);
    settingsCache.set(guildID, updated);
    return updated;
  },
};
