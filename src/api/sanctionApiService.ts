import { apiGet, apiPatch, apiPost } from "./client";

export type SanctionType = "WARN" | "MUTE" | "BAN_PENDING";
export type SanctionSeverity = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "UNFORGIVABLE";
export type SanctionNature = "Extremism" | "Violence" | "Hate" | "Harassment" | "Spam" | "Manipulation" | "Recidivism" | "Other";
export type SanctionState = "created" | "canceled";

export interface SanctionDTO {
  id: string;
  guildID: string;
  userID: string;
  moderatorID: string;
  type: SanctionType;
  severity: SanctionSeverity;
  nature: SanctionNature;
  state: SanctionState;
  reason: string;
  durationMs: number | null;
  createdAt: number;
}

export interface CreateSanctionInput {
  guildID: string;
  userID: string;
  moderatorID: string;
  type: SanctionType;
  severity: SanctionSeverity;
  nature: SanctionNature;
  reason: string;
  state?: SanctionState;
  durationMs?: number | null;
  createdAt?: number;
}

export interface UpdateSanctionInput {
  type?: SanctionType;
  severity?: SanctionSeverity;
  nature?: SanctionNature;
  state?: SanctionState;
  reason?: string;
  durationMs?: number | null;
}

const WEIGHT: Record<SanctionSeverity, number> = {
  NONE: 0,
  LOW: 0.25,
  MEDIUM: 0.25,
  HIGH: 0.5,
  UNFORGIVABLE: 0.5,
};

export const sanctionApiService = {
  async create(input: CreateSanctionInput): Promise<SanctionDTO> {
    return apiPost<SanctionDTO>(`/guilds/${input.guildID}/sanctions`, input);
  },

  async list(guildID: string, options?: { userID?: string; state?: SanctionState }): Promise<SanctionDTO[]> {
    const params = new URLSearchParams();
    if (options?.userID) params.set("userId", options.userID);
    if (options?.state) params.set("state", options.state);
    const query = params.size > 0 ? `?${params.toString()}` : "";
    return apiGet<SanctionDTO[]>(`/guilds/${guildID}/sanctions${query}`);
  },

  async get(guildID: string, sanctionID: string): Promise<SanctionDTO> {
    return apiGet<SanctionDTO>(`/guilds/${guildID}/sanctions/${sanctionID}`);
  },

  async revoke(guildID: string, sanctionID: string): Promise<SanctionDTO> {
    return apiPatch<SanctionDTO>(`/guilds/${guildID}/sanctions/${sanctionID}`, {});
  },

  async update(guildID: string, sanctionID: string, patch: UpdateSanctionInput): Promise<SanctionDTO> {
    return apiPatch<SanctionDTO>(`/guilds/${guildID}/sanctions/${sanctionID}`, patch);
  },

  async getActiveMultiplier(
    guildID: string,
    userID: string,
    sanctionDurationMs: number | null,
    referenceTimestamp: number = Date.now(),
  ): Promise<number> {
    const sanctions = await this.list(guildID, { userID, state: "created" });
    const active = sanctions.filter((s) => {
      if (s.createdAt > referenceTimestamp) return false;
      if (s.durationMs === null && sanctionDurationMs === null) return true;
      if (s.durationMs === null) return referenceTimestamp - s.createdAt < sanctionDurationMs!;
      return referenceTimestamp - s.createdAt < s.durationMs;
    });
    const total = active.reduce((sum, s) => sum + WEIGHT[s.severity], 0);
    return Math.min(7, 1 + total);
  },
};
