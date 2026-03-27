import { apiPost } from "./client";

export const guildMetaService = {
  async upsert(guildID: string, name: string, iconURL: string): Promise<void> {
    await apiPost("/guild-meta", { guildID, name, iconURL });
  },

  async bulkUpsert(rows: Array<{ guildID: string; name: string; iconURL: string }>): Promise<void> {
    await apiPost("/guild-meta", { rows });
  },
};
