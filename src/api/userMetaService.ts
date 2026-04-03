import { apiDeleteWithBody, apiPost } from "./client";

export const userMetaService = {
  async upsert(
    userID: string,
    guildID: string,
    username: string,
    displayName: string,
    avatarURL: string,
  ): Promise<void> {
    await apiPost("/user-meta", { userID, guildID, username, displayName, avatarURL });
  },

  async bulkUpsert(rows: Array<{
    userID: string;
    guildID: string;
    username: string;
    displayName: string;
    avatarURL: string;
  }>): Promise<void> {
    if (rows.length === 0) return;
    await apiPost("/user-meta", { rows });
  },

  async markDeleted(userID: string, guildID: string): Promise<void> {
    await apiDeleteWithBody("/user-meta", { userID, guildID });
  },

  async markDeletedExcept(guildID: string, activeUserIDs: string[]): Promise<void> {
    await apiDeleteWithBody("/user-meta", { guildID, activeUserIDs });
  },
};
