import { Op } from "sequelize";
import { VoiceSession } from "../models/VoiceSession";
import { DeafSession } from "../models/DeafSession";

export interface SessionAttributes {
  guildID: string;
  userID: string;
  channelID: string;
  start: number;
  end: number;
}

async function createSession(model: typeof VoiceSession | typeof DeafSession, data: SessionAttributes): Promise<void> {
  await model.create(data as any);
}

async function getGuildSessionsInIntersection(
  model: typeof VoiceSession | typeof DeafSession,
  guildID: string,
  start: number,
  end: number,
): Promise<SessionAttributes[]> {
  const rows = await model.findAll({
    where: {
      [Op.and]: [
        { start: { [Op.lte]: end } },
        { end: { [Op.gte]: start } },
        { guildID: { [Op.eq]: guildID } },
      ],
    },
  });
  return rows.map((r: any) => ({
    guildID: r.guildID,
    userID: r.userID,
    channelID: r.channelID,
    start: Number(r.start),
    end: Number(r.end),
  }));
}

export async function createVoiceSession(data: SessionAttributes): Promise<void> {
  await createSession(VoiceSession, data);
}

export async function createDeafSession(data: SessionAttributes): Promise<void> {
  await createSession(DeafSession, data);
}

export async function getVoiceSessionsInIntersection(
  guildID: string,
  start: number,
  end: number,
): Promise<SessionAttributes[]> {
  return getGuildSessionsInIntersection(VoiceSession, guildID, start, end);
}

export async function getDeafSessionsInIntersection(
  guildID: string,
  start: number,
  end: number,
): Promise<SessionAttributes[]> {
  return getGuildSessionsInIntersection(DeafSession, guildID, start, end);
}
