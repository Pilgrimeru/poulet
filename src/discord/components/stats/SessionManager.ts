import { deafSessionService, voiceSessionService } from "@/database/services";
import { SessionAttributes, SessionService } from "@/database/types";
import { Model } from "sequelize";

interface CurrentSession {
  userID: string;
  channelID: string;
  guildID: string;
  start: number;
}

export class SessionManager {
  protected currentSessions = new Map<string, CurrentSession>();
  private readonly sessionService: SessionService<Model<SessionAttributes>>;

  constructor(sessionService: SessionService<Model<SessionAttributes>>) {
    this.sessionService = sessionService;
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
      await this.sessionService.createSession({
        guildID: session.guildID,
        userID: session.userID,
        channelID: session.channelID,
        start: session.start,
        end: Date.now(),
      });
      console.log("Session saved to DB");
    } else if (session) {
      console.log("Session too short to be saved to DB", session.userID);
    } else {
      console.log("Session inexistante");
    }
    this.currentSessions.delete(userID);
  }

  public async endAllSessions(): Promise<void> {
    const endSessionPromises = Array.from(this.currentSessions.keys()).map(
      (userID) => this.endSession(userID),
    );
    await Promise.all(endSessionPromises);
  }

  public async getGuildCurrentSessions(
    guildId: string,
  ): Promise<CurrentSession[]> {
    return Array.from(this.currentSessions.values()).filter(
      (session) => session.guildID === guildId,
    );
  }
}

const voiceSessionManager = new SessionManager(voiceSessionService);

const deafSessionManager = new SessionManager(deafSessionService);

export { deafSessionManager, voiceSessionManager };
