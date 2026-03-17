import {
  StatsReportMessageState,
  StatsReportMessageStateAttributes,
} from "@/database/models";

class StatsReportMessageStateService {
  async getMessageID(guildID: string): Promise<string | undefined> {
    const state = await StatsReportMessageState.findByPk(guildID);
    return state?.messageID;
  }

  async upsertState(data: StatsReportMessageStateAttributes): Promise<void> {
    await StatsReportMessageState.upsert(data);
  }
}

export const statsReportMessageStateService = new StatsReportMessageStateService();
