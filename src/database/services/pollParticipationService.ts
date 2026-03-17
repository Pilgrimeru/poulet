import { Poll, PollParticipation } from "@/database/models";

class PollParticipationService {
  // Add or update a vote
  async addParticipation(
    pollId: string,
    userId: string,
    optionId: number,
  ): Promise<PollParticipation | null> {
    try {
      const poll = await Poll.findByPk(pollId);
      if (!poll) {
        return null;
      }

      const existingVote = await PollParticipation.findOne({
        where: {
          pollId,
          userId,
          option: optionId,
        },
      });

      if (existingVote) {
        return existingVote;
      }

      return await PollParticipation.create({
        pollId,
        userId,
        option: optionId,
      });
    } catch (error) {
      console.error("Error adding vote:", error);
      return null;
    }
  }

  // Remove a vote
  async removeParticipation(
    pollId: string,
    userId: string,
    optionId: number,
  ): Promise<boolean> {
    try {
      const deletedNumber = await PollParticipation.destroy({
        where: {
          pollId,
          userId,
          option: optionId,
        },
      });
      return deletedNumber > 0;
    } catch (error) {
      console.error("Error removing vote:", error);
      return false;
    }
  }

  async removeParticipations(pollId: string, userId: string): Promise<boolean> {
    try {
      const deletedNumber = await PollParticipation.destroy({
        where: {
          pollId,
          userId,
        },
      });
      return deletedNumber > 0;
    } catch (error) {
      console.error("Error removing vote:", error);
      return false;
    }
  }

  // Get all votes for a specific user in a poll
  async getUserPollParticipations(
    pollId: string,
    userId: string,
  ): Promise<PollParticipation[]> {
    try {
      return await PollParticipation.findAll({
        where: {
          pollId,
          userId,
        },
      });
    } catch (error) {
      console.error("Error getting user poll participations:", error);
      return [];
    }
  }

  // Get all votes for a specific user in a poll
  async getUserPollParticipation(
    pollId: string,
    userId: string,
    optionId: number,
  ): Promise<PollParticipation | null> {
    try {
      return await PollParticipation.findOne({
        where: {
          pollId,
          userId,
          option: optionId,
        },
      });
    } catch (error) {
      console.error("Error getting user poll participations:", error);
      return null;
    }
  }

  // Get all votes for a poll
  async getAllPollParticipations(pollId: string): Promise<PollParticipation[]> {
    try {
      return await PollParticipation.findAll({
        where: {
          pollId,
        },
      });
    } catch (error) {
      console.error("Error getting votes for session:", error);
      return [];
    }
  }
}

export const pollParticipationService = new PollParticipationService();
