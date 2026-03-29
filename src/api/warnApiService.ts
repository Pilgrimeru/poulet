import { apiGet, apiPatch, apiPost } from "./client";

export type WarnSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface WarnDTO {
  id: string;
  guildID: string;
  userID: string;
  moderatorID: string;
  reason: string;
  severity: WarnSeverity;
  isActive: boolean;
  createdAt: number;
  expiresAt: number | null;
}

export interface CreateWarnInput {
  guildID: string;
  userID: string;
  moderatorID: string;
  reason: string;
  severity: WarnSeverity;
  createdAt?: number;
  expiresAt?: number | null;
  isActive?: boolean;
}

export const warnApiService = {
  async create(input: CreateWarnInput): Promise<WarnDTO> {
    return apiPost<WarnDTO>(`/guilds/${input.guildID}/warns`, input);
  },

  async list(guildID: string, userID?: string): Promise<WarnDTO[]> {
    const query = userID ? `?userId=${encodeURIComponent(userID)}` : "";
    return apiGet<WarnDTO[]>(`/guilds/${guildID}/warns${query}`);
  },

  async revoke(guildID: string, warnID: string): Promise<WarnDTO> {
    return apiPatch<WarnDTO>(`/guilds/${guildID}/warns/${warnID}`, {});
  },

  async getActiveMultiplier(guildID: string, userID: string): Promise<number> {
    const warns = await this.list(guildID, userID);
    const now = Date.now();
    const total = warns
      .filter((warn) => warn.isActive && (warn.expiresAt === null || warn.expiresAt > now))
      .reduce((sum, warn) => {
        if (warn.severity === "HIGH") return sum + 0.5;
        return sum + 0.25;
      }, 0);
    return Math.min(7, total);
  },
};
