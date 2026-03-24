import { bot } from "@/app/runtime";
import {
  deafSessionService,
  messageHistoryService,
  voiceSessionService,
} from "@/database/services";
import { SessionService } from "@/database/types";
import {
  deafSessionManager,
  SessionManager,
  voiceSessionManager,
} from "@/discord/components";
import { TopTableData, TopTableRow } from "@/discord/types";
import { formatDuration, mapSubtraction } from "@/discord/utils";
import { Guild } from "discord.js";

export interface FilterOptions {
  allowBots: boolean; // default false
  allowDeaf: boolean; // default false
  allowAFKChannel: boolean; // default false
  blacklistChannel: string[];
  whitelistChannel: string[];
  blacklistUser: string[];
  whitelistUser: string[];
  rankingPreference: "voice" | "messages";
}

interface ProcessedOptions {
  start: number;
  end: number;
  guildID: string;
  allowDeaf: boolean;
  blacklistChannel: string[];
  whitelistChannel?: string[];
  blacklistUser: string[];
  whitelistUser?: string[];
  rankingPreference: "voice" | "messages";
}

export class StatsTableBuilder {
  public static async createTopTableData(
    start: number,
    end: number,
    guild: Guild,
    options?: Partial<FilterOptions>,
  ): Promise<TopTableData> {
    const processedOptions = await StatsTableBuilder.processOptions(
      start,
      end,
      guild,
      options,
    );

    const voiceMap = await StatsTableBuilder.createVoiceTotalMap(processedOptions);
    const messagesMap =
      await StatsTableBuilder.createMessagesTotalMap(processedOptions);

    let totalVocalTime = 0;
    let totalMessages = 0;
    let tempRows: any[] = [];

    const userIds = new Set([...voiceMap.keys(), ...messagesMap.keys()]);

    for (const userId of userIds) {
      let voiceTime = voiceMap.get(userId) ?? 0;
      voiceTime = Math.floor(voiceTime / 60000) * 60000;
      const messages = messagesMap.get(userId) ?? 0;
      const username =
        guild.members.cache.get(userId)?.user.username ??
        (await bot.users.fetch(userId))?.username ??
        userId;

      totalMessages += messages;
      if (messages > 0 || voiceTime > 60000) {
        totalVocalTime += voiceTime;
        tempRows.push({
          pseudo: username,
          vocal: voiceTime,
          message: messages,
        });
      }
    }

    tempRows.sort((a, b) => {
      if (processedOptions.rankingPreference === "messages") {
        if (b.message === a.message) {
          return b.vocal - a.vocal;
        }
        return b.message - a.message;
      }

      if (b.vocal === a.vocal) {
        return b.message - a.message;
      }
      return b.vocal - a.vocal;
    });

    const rows: TopTableRow[] = tempRows.map((row, index) => ({
      rank: index + 1,
      pseudo: row.pseudo,
      vocal: formatDuration(row.vocal),
      message: row.message,
    }));

    return {
      rows: rows,
      totalVocal: formatDuration(totalVocalTime),
      totalMessages: totalMessages,
    };
  }

  private static async processOptions(
    start: number,
    end: number,
    guild: Guild,
    options?: Partial<FilterOptions>,
  ): Promise<ProcessedOptions> {
    const processedBlacklistUser = new Set<string>();
    try {
      await guild.members.fetch({ time: 15000 });
    } catch (error) {
      console.warn(
        `[stats] members fetch failed for guild ${guild.id}, using cache only`,
        error,
      );
    }

    if (!options?.allowBots && !options?.whitelistUser?.length) {
      for (const [_, member] of guild.members.cache) {
        if (member.user.bot) {
          processedBlacklistUser.add(member.id);
        }
      }
    }
    if (options?.blacklistUser) {
      options.blacklistUser.forEach((user) => processedBlacklistUser.add(user));
    }

    const processedBlacklistChannel = new Array<string>();

    if (
      !options?.allowAFKChannel &&
      guild.afkChannelId &&
      !options?.blacklistChannel?.includes(guild.afkChannelId)
    ) {
      processedBlacklistChannel.push(guild.afkChannelId);
    }
    if (options?.blacklistChannel) {
      processedBlacklistChannel.push(...options.blacklistChannel);
    }

    return {
      start: start,
      end: end,
      guildID: guild.id,
      allowDeaf: Boolean(options?.allowDeaf),
      blacklistChannel: processedBlacklistChannel,
      whitelistChannel: options?.whitelistChannel,
      blacklistUser: Array.from(processedBlacklistUser),
      whitelistUser: options?.whitelistUser,
      rankingPreference: options?.rankingPreference ?? "voice",
    };
  }

  private static async createVoiceTotalMap(options: ProcessedOptions) {
    const rawVoiceTime = await StatsTableBuilder.createSessionTotalMap(
      options,
      voiceSessionService,
      voiceSessionManager,
    );
    if (options.allowDeaf) {
      return rawVoiceTime;
    }
    const deafTime = await StatsTableBuilder.createSessionTotalMap(
      options,
      deafSessionService,
      deafSessionManager,
    );

    return mapSubtraction(rawVoiceTime, deafTime);
  }

  private static async createMessagesTotalMap(options: ProcessedOptions) {
    const info =
      await messageHistoryService.countGuildMessagesBetweenDatesByUserAndChannel(
        options.guildID,
        options.start,
        options.end,
      );
    const totalByMember = new Map<string, number>();
    info.forEach((value) => {
      if (
        ((!options.whitelistChannel &&
          !options.blacklistChannel.includes(value.dataValues.channelID)) ||
          (options.whitelistChannel?.includes(value.dataValues.channelID))) &&
        ((!options.whitelistUser &&
          !options.blacklistUser.includes(value.dataValues.userID)) ||
          (options.whitelistUser?.includes(value.dataValues.userID)))
      ) {
        if (!totalByMember.has(value.dataValues.userID)) {
          totalByMember.set(value.dataValues.userID, 0);
        }
        totalByMember.set(
          value.dataValues.userID,
          value.dataValues.messageCount +
            totalByMember.get(value.dataValues.userID),
        );
      }
    });

    return totalByMember;
  }

  private static async createSessionTotalMap(
    options: ProcessedOptions,
    sessionService: SessionService<any>,
    sessionManager: SessionManager,
  ): Promise<Map<string, number>> {
    const sessions = await sessionService.getGuildSessionsInIntersection(
      options.guildID,
      options.start,
      options.end,
    );

    const totalByMember = new Map<string, number>();

    sessions.forEach((session) => {
      if (
        ((!options.whitelistChannel &&
          !options.blacklistChannel.includes(session.channelID)) ||
          (options.whitelistChannel?.includes(session.channelID))) &&
        ((!options.whitelistUser &&
          !options.blacklistUser.includes(session.userID)) ||
          (options.whitelistUser?.includes(session.userID)))
      ) {
        if (!totalByMember.has(session.dataValues.userID)) {
          totalByMember.set(session.dataValues.userID, 0);
        }

        const sessionDuration = Number(
          Math.min(session.dataValues.end, options.end) -
            Math.max(session.dataValues.start, options.start),
        );
        const previousDuration = totalByMember.get(session.dataValues.userID)!;

        totalByMember.set(
          session.dataValues.userID,
          previousDuration + sessionDuration,
        );
      }
    });

    const unfinishedSessions = await sessionManager.getGuildCurrentSessions(
      options.guildID,
    );
    const now = Date.now();
    unfinishedSessions.forEach((unfinishedSession) => {
      if (
        ((!options.whitelistChannel &&
          !options.blacklistChannel.includes(unfinishedSession.channelID)) ||
          (options.whitelistChannel?.includes(unfinishedSession.channelID))) &&
        ((!options.whitelistUser &&
          !options.blacklistUser.includes(unfinishedSession.userID)) ||
          (options.whitelistUser?.includes(unfinishedSession.userID)))
      ) {
        if (!totalByMember.has(unfinishedSession.userID)) {
          totalByMember.set(unfinishedSession.userID, 0);
        }

        const sessionDuration = Number(
          Math.min(now, options.end) -
            Math.max(unfinishedSession.start, options.start),
        );
        const previousDuration = totalByMember.get(unfinishedSession.userID)!;
        totalByMember.set(
          unfinishedSession.userID,
          previousDuration + sessionDuration,
        );
      }
    });

    return totalByMember;
  }
}
