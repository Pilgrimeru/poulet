import { apiDelete, apiGet, apiPost } from "./client";

interface StoredInvite {
  inviterID: string;
  inviterTag: string;
  code: string;
}

export const memberInviteService = {
  async store(guildID: string, userID: string, inviterID: string, inviterTag: string, code: string): Promise<void> {
    await apiPost("/member-invites", { guildID, userID, inviterID, inviterTag, code });
  },

  async get(guildID: string, userID: string): Promise<StoredInvite | null> {
    return apiGet<StoredInvite | null>(`/member-invites?guildID=${guildID}&userID=${userID}`);
  },

  async remove(guildID: string, userID: string): Promise<void> {
    await apiDelete(`/member-invites`, { guildID, userID });
  },
};
