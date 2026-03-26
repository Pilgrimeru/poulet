import { apiGet, apiPut } from "./client";

export const statsReportMessageStateService = {
  async getMessageID(guildID: string): Promise<string | undefined> {
    const result = await apiGet<{ messageID: string | null }>(`/guilds/${guildID}/stats-report-state`);
    return result.messageID ?? undefined;
  },

  async upsertState(data: { guildID: string; messageID: string }): Promise<void> {
    await apiPut(`/guilds/${data.guildID}/stats-report-state`, { messageID: data.messageID });
  },
};
