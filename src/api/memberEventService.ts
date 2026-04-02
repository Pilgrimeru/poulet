import { apiPost } from "./client";

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
};
