import { Op } from "sequelize";
import { VoiceSession } from "@/database/models";
import { SessionAttributes, SessionService } from "@/database/types";

class VoiceSessionService extends SessionService<VoiceSession> {
  async createSession(sessionData: SessionAttributes): Promise<VoiceSession> {
    return VoiceSession.create(sessionData);
  }

  async updateSession(
    userID: string,
    start: number,
    updates: Partial<SessionAttributes>,
  ): Promise<[affectedCount: number]> {
    return VoiceSession.update(updates, {
      where: {
        userID,
        start,
      },
    });
  }

  async deleteSession(userID: string, start: number): Promise<number> {
    return VoiceSession.destroy({
      where: {
        userID,
        start,
      },
    });
  }

  async getSession(
    userID: string,
    start: number,
  ): Promise<VoiceSession | null> {
    return VoiceSession.findOne({
      where: {
        userID,
        start,
      },
    });
  }

  async getAllSessions(): Promise<VoiceSession[] | null> {
    return VoiceSession.findAll();
  }

  async getAllSessionsInIntersection(
    start: number,
    end: number,
  ): Promise<VoiceSession[]> {
    return VoiceSession.findAll({
      where: {
        [Op.and]: [{ start: { [Op.lte]: end } }, { end: { [Op.gte]: start } }],
      },
    });
  }

  async getGuildSessionsInIntersection(
    guildID: string,
    start: number,
    end: number,
  ): Promise<VoiceSession[]> {
    return VoiceSession.findAll({
      where: {
        [Op.and]: [
          { start: { [Op.lte]: end } },
          { end: { [Op.gte]: start } },
          { guildID: { [Op.eq]: guildID } },
        ],
      },
    });
  }
}

export const voiceSessionService = new VoiceSessionService();
