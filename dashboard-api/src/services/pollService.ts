import { Poll } from "../db/models/Poll";
import { PollParticipation } from "../db/models/PollParticipation";

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

function pollToDTO(row: Poll): PollDTO {
  return {
    pollId: row.pollId,
    title: row.title,
    messagePath: row.messagePath,
    expiration: Number(row.expiration),
    allowMultipleChoice: row.allowMultipleChoice,
    options: row.options,
    isClosed: row.isClosed,
  };
}

export async function createPoll(data: Omit<PollDTO, "isClosed">): Promise<PollDTO> {
  const row = await Poll.create({ ...data, isClosed: false } as any);
  return pollToDTO(row);
}

export async function getPoll(pollId: string): Promise<PollDTO | null> {
  const row = await Poll.findByPk(pollId);
  return row ? pollToDTO(row) : null;
}

export async function closePoll(pollId: string): Promise<void> {
  await Poll.update({ isClosed: true } as any, { where: { pollId } });
}

export async function getAllActivePolls(): Promise<PollDTO[]> {
  const rows = await Poll.findAll({ where: { isClosed: false } });
  return rows.map(pollToDTO);
}

export async function deletePoll(pollId: string): Promise<void> {
  await Poll.destroy({ where: { pollId } });
}

export async function addParticipation(
  pollId: string,
  userId: string,
  option: number,
): Promise<PollParticipationDTO | null> {
  const poll = await Poll.findByPk(pollId);
  if (!poll) return null;

  const existing = await PollParticipation.findOne({ where: { pollId, userId, option } });
  if (existing) return { pollId: existing.pollId, userId: existing.userId, option: existing.option };

  const row = await PollParticipation.create({ pollId, userId, option } as any);
  return { pollId: row.pollId, userId: row.userId, option: row.option };
}

export async function removeParticipation(pollId: string, userId: string, option: number): Promise<boolean> {
  const deleted = await PollParticipation.destroy({ where: { pollId, userId, option } });
  return deleted > 0;
}

export async function removeAllParticipations(pollId: string, userId: string): Promise<boolean> {
  const deleted = await PollParticipation.destroy({ where: { pollId, userId } });
  return deleted > 0;
}

export async function getUserParticipation(
  pollId: string,
  userId: string,
  option: number,
): Promise<PollParticipationDTO | null> {
  const row = await PollParticipation.findOne({ where: { pollId, userId, option } });
  return row ? { pollId: row.pollId, userId: row.userId, option: row.option } : null;
}

export async function getUserParticipations(pollId: string, userId: string): Promise<PollParticipationDTO[]> {
  const rows = await PollParticipation.findAll({ where: { pollId, userId } });
  return rows.map((r) => ({ pollId: r.pollId, userId: r.userId, option: r.option }));
}

export async function getAllParticipations(pollId: string): Promise<PollParticipationDTO[]> {
  const rows = await PollParticipation.findAll({ where: { pollId } });
  return rows.map((r) => ({ pollId: r.pollId, userId: r.userId, option: r.option }));
}
