import { Poll } from "@/database/models";
import { PollAttributes } from "@/database/types";

class PollService {
  async createPoll(PollData: PollAttributes): Promise<Poll> {
    return Poll.create(PollData);
  }

  async deletePoll(pollId: string): Promise<void> {
    await Poll.destroy({ where: { pollId } });
  }

  async getPoll(pollId: string): Promise<Poll | null> {
    return Poll.findByPk(pollId);
  }

  async getAllActivePolls(): Promise<Poll[]> {
    return Poll.findAll({ where: { isClosed: false } });
  }
}

export const pollService = new PollService();
