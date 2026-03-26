import { apiGet, apiPost } from "./client";

export interface SessionAttributes {
  guildID: string;
  userID: string;
  channelID: string;
  start: number;
  end: number;
}

export const voiceSessionService = {
  async createSession(data: SessionAttributes): Promise<void> {
    await apiPost("/sessions/voice", data);
  },

  async getGuildSessionsInIntersection(guildID: string, start: number, end: number): Promise<SessionAttributes[]> {
    const params = new URLSearchParams({ guildID, start: String(start), end: String(end) });
    return apiGet(`/sessions/voice?${params}`);
  },
};

export const deafSessionService = {
  async createSession(data: SessionAttributes): Promise<void> {
    await apiPost("/sessions/deaf", data);
  },

  async getGuildSessionsInIntersection(guildID: string, start: number, end: number): Promise<SessionAttributes[]> {
    const params = new URLSearchParams({ guildID, start: String(start), end: String(end) });
    return apiGet(`/sessions/deaf?${params}`);
  },
};
