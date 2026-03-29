import { apiGet, apiPatch, apiPost } from "./client";

export type SanctionType = "MUTE" | "BAN_PENDING";

export interface SanctionDTO {
  id: string;
  guildID: string;
  userID: string;
  moderatorID: string;
  type: SanctionType;
  reason: string;
  warnID: string | null;
  isActive: boolean;
  durationMs: number | null;
  createdAt: number;
  expiresAt: number | null;
}

export interface CreateSanctionInput {
  guildID: string;
  userID: string;
  moderatorID: string;
  type: SanctionType;
  reason: string;
  warnID?: string | null;
  isActive?: boolean;
  durationMs?: number | null;
  createdAt?: number;
  expiresAt?: number | null;
}

export interface UpdateSanctionInput {
  type?: SanctionType;
  reason?: string;
  isActive?: boolean;
  durationMs?: number | null;
  expiresAt?: number | null;
}

export const sanctionApiService = {
  async create(input: CreateSanctionInput): Promise<SanctionDTO> {
    return apiPost<SanctionDTO>(`/guilds/${input.guildID}/sanctions`, input);
  },

  async list(guildID: string, options?: { userID?: string; activeOnly?: boolean }): Promise<SanctionDTO[]> {
    const params = new URLSearchParams();
    if (options?.userID) params.set("userId", options.userID);
    if (options?.activeOnly) params.set("activeOnly", "true");
    const query = params.size > 0 ? `?${params.toString()}` : "";
    return apiGet<SanctionDTO[]>(`/guilds/${guildID}/sanctions${query}`);
  },

  async revoke(guildID: string, sanctionID: string): Promise<SanctionDTO> {
    return apiPatch<SanctionDTO>(`/guilds/${guildID}/sanctions/${sanctionID}`, {});
  },

  async update(guildID: string, sanctionID: string, patch: UpdateSanctionInput): Promise<SanctionDTO> {
    return apiPatch<SanctionDTO>(`/guilds/${guildID}/sanctions/${sanctionID}`, patch);
  },
};
