import { DeafSession } from "@/database/models";
import { SessionAttributes, SessionService } from "@/database/types";
import { Op } from "sequelize";

class DeafSessionService extends SessionService<DeafSession> {
  async createSession(sessionData: SessionAttributes): Promise<DeafSession> {
    return DeafSession.create(sessionData);
  }

  async updateSession(
    userID: string,
    start: number,
    updates: Partial<SessionAttributes>,
  ): Promise<[affectedCount: number]> {
    return DeafSession.update(updates, {
      where: {
        userID,
        start,
      },
    });
  }

  async deleteSession(userID: string, start: number): Promise<number> {
    return DeafSession.destroy({
      where: {
        userID,
        start,
      },
    });
  }

  async getSession(userID: string, start: number): Promise<DeafSession | null> {
    return DeafSession.findOne({
      where: {
        userID,
        start,
      },
    });
  }

  async getAllSessions(): Promise<DeafSession[] | null> {
    return DeafSession.findAll();
  }

  async getAllSessionsInIntersection(
    start: number,
    end: number,
  ): Promise<DeafSession[]> {
    return DeafSession.findAll({
      where: {
        [Op.and]: [{ start: { [Op.lte]: end } }, { end: { [Op.gte]: start } }],
      },
    });
  }

  async getGuildSessionsInIntersection(
    guildID: string,
    start: number,
    end: number,
  ): Promise<DeafSession[]> {
    return DeafSession.findAll({
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

export const deafSessionService = new DeafSessionService();
