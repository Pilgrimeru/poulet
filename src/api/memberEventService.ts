import { apiGet, apiPost } from "./client";

export const memberEventService = {
  async recordJoin(guildID: string, userID: string): Promise<void> {
    await apiPost("/member-events", { guildID, userID, type: "join", date: Date.now() });
  },

  async recordLeave(guildID: string, userID: string): Promise<void> {
    await apiPost("/member-events", { guildID, userID, type: "leave", date: Date.now() });
  },

  async seedJoins(events: Array<{ guildID: string; userID: string; date: number }>): Promise<void> {
    await apiPost("/member-events", { bulk: true, events });
  },

  async hasJoinedBefore(guildID: string, userID: string): Promise<boolean> {
    const data = await apiGet<{ joinCount: number }>(
      `/member-events?guildID=${guildID}&userID=${userID}`,
    );
    // The current join is already recorded, so > 1 means they've been here before
    return data.joinCount > 1;
  },
};
