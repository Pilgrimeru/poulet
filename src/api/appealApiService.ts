import { apiGet, apiPatch, apiPost } from "./client";

export type AppealStatus = "pending_review" | "upheld" | "overturned";

export interface AppealDTO {
  id: string;
  sanctionID: string;
  text: string;
  status: AppealStatus;
  createdAt: number;
}

export interface UpdateAppealInput {
  status: AppealStatus;
}

export const appealApiService = {
  async create(guildID: string, sanctionID: string, text: string): Promise<AppealDTO> {
    return apiPost<AppealDTO>(`/guilds/${guildID}/appeals`, { sanctionID, text });
  },

  async list(guildID: string, options?: { sanctionID?: string; status?: AppealStatus }): Promise<AppealDTO[]> {
    const params = new URLSearchParams();
    if (options?.sanctionID) params.set("sanctionId", options.sanctionID);
    if (options?.status) params.set("status", options.status);
    const query = params.size > 0 ? `?${params.toString()}` : "";
    return apiGet<AppealDTO[]>(`/guilds/${guildID}/appeals${query}`);
  },

  async update(guildID: string, appealID: string, patch: UpdateAppealInput): Promise<AppealDTO> {
    return apiPatch<AppealDTO>(`/guilds/${guildID}/appeals/${appealID}`, patch);
  },
};
