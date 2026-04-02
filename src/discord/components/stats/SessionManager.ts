import { deafSessionService, type SessionAttributes, voiceSessionService } from "@/api";
import { enqueuePendingSessions } from "./sessionBacklog";

interface CurrentSession {
  userID: string;
  channelID: string;
  guildID: string;
  start: number;
}

interface ApiSessionService {
  createSession(data: { guildID: string; userID: string; channelID: string; start: number; end: number }): Promise<void>;
}

export class SessionManager {
  protected currentSessions = new Map<string, CurrentSession>();
  private readonly sessionService: ApiSessionService;
  private readonly sessionKind: "voice" | "deaf";

  constructor(sessionService: ApiSessionService, sessionKind: "voice" | "deaf") {
    this.sessionService = sessionService;
    this.sessionKind = sessionKind;
  }

  public async startSession(
    userID: string,
    channelId: string,
    guildId: string,
  ): Promise<void> {
    this.currentSessions.set(userID, {
      userID: userID,
      channelID: channelId,
      guildID: guildId,
      start: Date.now(),
    });
  }

  public async endSession(userID: string): Promise<void> {
    const session = this.currentSessions.get(userID);
    if (session && Date.now() - session.start > 10000) {
      const endedSession = this.toSessionAttributes(session);

      try {
        await this.sessionService.createSession(endedSession);
        console.log("Session saved to DB");
      } catch (error) {
        console.error("Erreur lors de la sauvegarde de la session en API, stockage local en secours.", error);
        await enqueuePendingSessions(this.sessionKind, [endedSession]);
      }
    } else if (session) {
      console.log("Session too short to be saved to DB", session.userID);
    } else {
      console.log("Session inexistante");
    }
    this.currentSessions.delete(userID);
  }

  public async endAllSessions(): Promise<void> {
    const sessions = Array.from(this.currentSessions.values());
    const failedSessions: SessionAttributes[] = [];

    this.currentSessions.clear();

    await Promise.all(sessions.map(async (session) => {
      if (Date.now() - session.start <= 10000) {
        console.log("Session too short to be saved to DB", session.userID);
        return;
      }

      const endedSession = this.toSessionAttributes(session);

      try {
        await this.sessionService.createSession(endedSession);
        console.log("Session saved to DB");
      } catch (error) {
        failedSessions.push(endedSession);
        console.error("Erreur lors de la sauvegarde de la session en API, stockage local en secours.", error);
      }
    }));

    await enqueuePendingSessions(this.sessionKind, failedSessions);
  }

  public async getGuildCurrentSessions(
    guildId: string,
  ): Promise<CurrentSession[]> {
    return Array.from(this.currentSessions.values()).filter(
      (session) => session.guildID === guildId,
    );
  }

  private toSessionAttributes(session: CurrentSession): SessionAttributes {
    return {
      guildID: session.guildID,
      userID: session.userID,
      channelID: session.channelID,
      start: session.start,
      end: Date.now(),
    };
  }
}

const voiceSessionManager = new SessionManager(voiceSessionService, "voice");

const deafSessionManager = new SessionManager(deafSessionService, "deaf");

export { deafSessionManager, voiceSessionManager };
