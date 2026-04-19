import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

export type QuestionType = "open_text" | "single_choice" | "multiple_choice";

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  minValues?: number;
  maxValues?: number;
  maxLength?: number;
  placeholder?: string;
}

export type SubmissionStatus = "pending" | "accepted" | "rejected";

export interface ApplicationFormDTO {
  id: string;
  guildID: string;
  name: string;
  description: string;
  questions: Question[];
  acceptRoleIDs: string[];
  removeRoleIDs: string[];
  rejectRoleIDs: string[];
  welcomeChannelID: string | null;
  welcomeMessageID: string | null;
  submissionChannelID: string | null;
  cooldownMs: number;
  sessionTimeoutMs: number;
  isActive: boolean;
  createdAt: number;
}

export interface ApplicationSubmissionDTO {
  id: string;
  formID: string;
  guildID: string;
  userID: string;
  answers: Record<string, string | string[]>;
  status: SubmissionStatus;
  reviewerNotes: string | null;
  reviewedAt: number | null;
  reviewedByUserID: string | null;
  rolesApplied: boolean;
  createdAt: number;
}

export interface ApplicationSessionDTO {
  id: string;
  formID: string;
  guildID: string;
  userID: string;
  currentStep: number;
  answers: Record<string, string | string[]>;
  expiresAt: number;
  createdAt: number;
}

export interface PendingRoleItem {
  submission: ApplicationSubmissionDTO;
  form: {
    id: string;
    name: string;
    acceptRoleIDs: string[];
    removeRoleIDs: string[];
    rejectRoleIDs: string[];
    cooldownMs: number;
  };
}

export const applicationService = {
  // Forms
  async listForms(guildID: string, options?: { isActive?: boolean }): Promise<ApplicationFormDTO[]> {
    const params = new URLSearchParams();
    if (options?.isActive !== undefined) params.set("isActive", String(options.isActive));
    const query = params.size > 0 ? `?${params.toString()}` : "";
    return apiGet<ApplicationFormDTO[]>(`/guilds/${guildID}/applications${query}`);
  },

  async getForm(guildID: string, formID: string): Promise<ApplicationFormDTO | null> {
    return apiGet<ApplicationFormDTO>(`/guilds/${guildID}/applications/${formID}`).catch(() => null);
  },

  async patchForm(guildID: string, formID: string, patch: Partial<ApplicationFormDTO>): Promise<ApplicationFormDTO> {
    return apiPatch<ApplicationFormDTO>(`/guilds/${guildID}/applications/${formID}`, patch);
  },

  async listFormsNeedingWelcomePost(guildID: string): Promise<ApplicationFormDTO[]> {
    return apiGet<ApplicationFormDTO[]>(`/guilds/${guildID}/applications/needs-welcome-post`);
  },

  // Submissions
  async createSubmission(
    guildID: string,
    formID: string,
    userID: string,
    answers: Record<string, string | string[]>,
  ): Promise<ApplicationSubmissionDTO> {
    return apiPost<ApplicationSubmissionDTO>(`/guilds/${guildID}/applications/${formID}/submissions`, {
      userID,
      answers,
    });
  },

  async listPendingRoles(guildID: string): Promise<PendingRoleItem[]> {
    return apiGet<PendingRoleItem[]>(`/guilds/${guildID}/applications/pending-roles`);
  },

  async markRolesApplied(guildID: string, formID: string, submissionID: string): Promise<void> {
    await apiPatch(`/guilds/${guildID}/applications/${formID}/submissions/${submissionID}`, {
      rolesApplied: true,
    });
  },

  async getActiveSubmission(
    guildID: string,
    formID: string,
    userID: string,
  ): Promise<ApplicationSubmissionDTO | null> {
    const params = new URLSearchParams({ status: "pending", userId: userID });
    const result = await apiGet<{ items: ApplicationSubmissionDTO[] }>(
      `/guilds/${guildID}/applications/${formID}/submissions?${params.toString()}&limit=1`,
    ).catch(() => null);
    return result?.items[0] ?? null;
  },

  async getLatestRejectedSubmission(
    guildID: string,
    formID: string,
    userID: string,
  ): Promise<ApplicationSubmissionDTO | null> {
    const params = new URLSearchParams({ status: "rejected", userId: userID });
    const result = await apiGet<{ items: ApplicationSubmissionDTO[] }>(
      `/guilds/${guildID}/applications/${formID}/submissions?${params.toString()}&limit=1`,
    ).catch(() => null);
    return result?.items[0] ?? null;
  },

  // Sessions
  async getSession(guildID: string, formID: string, userID: string): Promise<ApplicationSessionDTO | null> {
    const params = new URLSearchParams({ formId: formID, userId: userID });
    return apiGet<ApplicationSessionDTO | null>(
      `/guilds/${guildID}/application-sessions?${params.toString()}`,
    ).catch(() => null);
  },

  async createSession(guildID: string, formID: string, userID: string): Promise<ApplicationSessionDTO> {
    return apiPost<ApplicationSessionDTO>(`/guilds/${guildID}/application-sessions`, {
      formId: formID,
      userId: userID,
    });
  },

  async updateSession(
    guildID: string,
    sessionID: string,
    patch: { currentStep?: number; answers?: Record<string, string | string[]>; expiresAt?: number },
  ): Promise<ApplicationSessionDTO> {
    return apiPatch<ApplicationSessionDTO>(
      `/guilds/${guildID}/application-sessions/${sessionID}`,
      patch,
    );
  },

  async deleteSession(guildID: string, sessionID: string): Promise<void> {
    await apiDelete(`/guilds/${guildID}/application-sessions/${sessionID}`);
  },

  async deleteExpiredSessions(guildID: string): Promise<{ deleted: number }> {
    return apiDelete<{ deleted: number }>(`/guilds/${guildID}/application-sessions`);
  },
};
