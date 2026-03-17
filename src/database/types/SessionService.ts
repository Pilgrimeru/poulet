import { Model } from "sequelize";
import { SessionAttributes } from "@/database/types";

export abstract class SessionService<T extends Model> {
  abstract createSession(sessionData: SessionAttributes): Promise<T>;

  abstract updateSession(
    userID: string,
    start: number,
    updates: Partial<SessionAttributes>,
  ): Promise<[affectedCount: number]>;

  abstract deleteSession(userID: string, start: number): Promise<number>;

  abstract getSession(userID: string, start: number): Promise<T | null>;

  abstract getAllSessions(): Promise<T[] | null>;

  abstract getAllSessionsInIntersection(
    start: number,
    end: number,
  ): Promise<T[]>;

  abstract getGuildSessionsInIntersection(
    guildID: string,
    start: number,
    end: number,
  ): Promise<T[]>;
}
