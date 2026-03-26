import { apiGet, apiPost } from "./client";

export interface MessageHistoryAttributes {
  userID: string;
  date: number;
  channelID: string;
  guildID: string;
  messageID: string;
}

export interface MessageCountByUserAndChannel {
  userID: string;
  channelID: string;
  messageCount: number;
}

export const messageHistoryService = {
  async createMessageHistory(data: MessageHistoryAttributes): Promise<void> {
    await apiPost("/message-history", data);
  },

  async getLatestByUserInChannel(
    guildID: string,
    userID: string,
    channelID: string,
  ): Promise<{ messageID: string } | null> {
    const params = new URLSearchParams({ guildID, userID, channelID });
    try {
      return await apiGet(`/message-history/latest?${params}`);
    } catch {
      return null;
    }
  },

  async countGuildMessagesBetweenDatesByUserAndChannel(
    guildID: string,
    startDate: number,
    endDate: number,
  ): Promise<MessageCountByUserAndChannel[]> {
    const params = new URLSearchParams({ guildID, startDate: String(startDate), endDate: String(endDate) });
    return apiGet(`/message-history/count?${params}`);
  },
};
