import { apiDelete, apiGet, apiPost } from "./client";

export interface PollDTO {
  pollId: string;
  title: string;
  messagePath: string;
  expiration: number;
  allowMultipleChoice: boolean;
  options: string;
  isClosed: boolean;
}

export interface PollParticipationDTO {
  pollId: string;
  userId: string;
  option: number;
}

export const pollService = {
  async createPoll(data: Omit<PollDTO, "isClosed">): Promise<PollDTO> {
    return apiPost("/polls", data);
  },

  async getPoll(pollId: string): Promise<PollDTO | null> {
    try {
      return await apiGet(`/polls/${pollId}`);
    } catch {
      return null;
    }
  },

  async closePoll(pollId: string): Promise<void> {
    await apiPost(`/polls/${pollId}/close`);
  },

  async getAllActivePolls(): Promise<PollDTO[]> {
    return apiGet("/polls/active");
  },

  async deletePoll(pollId: string): Promise<void> {
    await apiDelete(`/polls/${pollId}`);
  },
};

export const pollParticipationService = {
  async addParticipation(pollId: string, userId: string, option: number): Promise<PollParticipationDTO | null> {
    try {
      return await apiPost(`/polls/${pollId}/participations`, { userId, option });
    } catch {
      return null;
    }
  },

  async removeParticipation(pollId: string, userId: string, option: number): Promise<boolean> {
    const result = await apiDelete<{ deleted: boolean }>(`/polls/${pollId}/participations`, {
      userId,
      option: String(option),
    });
    return result.deleted;
  },

  async removeParticipations(pollId: string, userId: string): Promise<boolean> {
    const result = await apiDelete<{ deleted: boolean }>(`/polls/${pollId}/participations/all`, { userId });
    return result.deleted;
  },

  async getUserPollParticipation(pollId: string, userId: string, option: number): Promise<PollParticipationDTO | null> {
    const params = new URLSearchParams({ userId, option: String(option) });
    try {
      return await apiGet(`/polls/${pollId}/participations?${params}`);
    } catch {
      return null;
    }
  },

  async getUserPollParticipations(pollId: string, userId: string): Promise<PollParticipationDTO[]> {
    const params = new URLSearchParams({ userId });
    return apiGet(`/polls/${pollId}/participations?${params}`);
  },

  async getAllPollParticipations(pollId: string): Promise<PollParticipationDTO[]> {
    return apiGet(`/polls/${pollId}/participations`);
  },
};
