import { StatsReportMessageState } from "../models/StatsReportMessageState";

export async function getMessageID(guildID: string): Promise<string | undefined> {
  const row = await StatsReportMessageState.findByPk(guildID);
  return row?.messageID;
}

export async function upsertState(guildID: string, messageID: string): Promise<void> {
  await StatsReportMessageState.upsert({ guildID, messageID } as any);
}
