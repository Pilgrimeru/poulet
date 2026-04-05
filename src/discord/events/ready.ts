import { appealApiService, channelMetaService, deafSessionService, guildMetaService, messageSnapshotService, sanctionApiService, userMetaService, voiceSessionService } from "@/api";
import { memberEventService } from "@/api/memberEventService";
import { bot } from "@/app/runtime";
import { startStatsReportScheduler } from "@/discord/components";
import { flushPendingSessions } from "@/discord/components/stats/sessionBacklog";
import { registerPollHandlers } from "@/discord/interactions";
import { Event } from "@/discord/types";
import { cacheGuildInvites } from "@/services/inviteTrackerService";
import { ActivityType } from "discord.js";

export default new Event("clientReady", () => {
  console.log(`${bot.user!.username} ready!`);

  // Seed guild & channel metadata from Discord cache
  void (async () => {
    const guildRows: Array<{ guildID: string; name: string; iconURL: string }> = [];
    const channelRows: Array<{
      channelID: string;
      guildID: string;
      name: string;
      parentID: string | null;
      parentName: string | null;
      channelType: number | null;
    }> = [];

    for (const guild of bot.guilds.cache.values()) {
      guildRows.push({
        guildID: guild.id,
        name: guild.name,
        iconURL: guild.iconURL() ?? "",
      });

      for (const channel of guild.channels.cache.values()) {
        if ("name" in channel && channel.name) {
          const parentID = "parentId" in channel ? channel.parentId ?? null : null;
          const parentName = "parent" in channel && channel.parent ? channel.parent.name : null;
          channelRows.push({
            channelID: channel.id,
            guildID: guild.id,
            name: channel.name,
            parentID,
            parentName,
            channelType: channel.type,
          });
        }
      }
    }

    await guildMetaService.bulkUpsert(guildRows);
    await channelMetaService.bulkUpsert(channelRows);

    // Soft-delete channels that are no longer in Discord (per guild)
    for (const guild of bot.guilds.cache.values()) {
      const activeIDs = channelRows
        .filter((r) => r.guildID === guild.id)
        .map((r) => r.channelID);
      await channelMetaService.markDeletedExcept(guild.id, activeIDs).catch(() => undefined);
    }
  })();
  for (const guild of bot.guilds.cache.values()) {
    void cacheGuildInvites(guild);
  }
  void flushPendingSessions("voice", (session) => voiceSessionService.createSession(session));
  void flushPendingSessions("deaf", (session) => deafSessionService.createSession(session));
  void bot.startSessionsForGuildMembers();
  void bot.startPollExpiration();
  seedMemberJoins().catch((err: unknown) => console.error("[members] Erreur seed joins:", err));
  seedUserMetas().catch((err: unknown) => console.error("[userMeta] Erreur seed:", err));
  startStatsReportScheduler();
  registerPollHandlers();
  void syncOverturnedAppeals();
  let appealSyncChain = Promise.resolve();
  setInterval(() => {
    appealSyncChain = appealSyncChain.then(() => syncOverturnedAppeals(), () => syncOverturnedAppeals());
  }, 60_000);

  // Purge old message snapshots on startup then every 24h
  void messageSnapshotService.purgeOldSnapshots().then((n) => {
    if (n > 0) console.log(`[snapshots] ${n} snapshot(s) supprimé(s) (rétention ${process.env["MESSAGE_RETENTION_DAYS"] ?? "7"}j)`);
  });
  setInterval(() => void messageSnapshotService.purgeOldSnapshots(), 24 * 3600 * 1000);

  bot.user!.setActivity(`/help`, { type: ActivityType.Listening });
  setInterval(() => {
    bot.user!.setActivity(`/help`, { type: ActivityType.Listening });
  }, 3600 * 1000);
});

async function seedMemberJoins(): Promise<void> {
  const now = Date.now();
  const events: Array<{ guildID: string; userID: string; date: number }> = [];
  const LARGE_GUILD_THRESHOLD = 500;

  for (const guild of bot.guilds.cache.values()) {
    const members = guild.memberCount <= LARGE_GUILD_THRESHOLD
      ? await guild.members.fetch().catch(() => guild.members.cache)
      : guild.members.cache;
    for (const member of members.values()) {
      if (member.user.bot) continue;
      events.push({ guildID: guild.id, userID: member.id, date: member.joinedTimestamp ?? now });
    }
  }

  if (events.length === 0) return;
  await memberEventService.seedJoins(events);
  console.log(`[members] ${events.length} jointure(s) seedée(s).`);
}

async function seedUserMetas(): Promise<void> {
  const rows: Array<{ userID: string; guildID: string; username: string; displayName: string; avatarURL: string }> = [];

  for (const guild of bot.guilds.cache.values()) {
    const members = await guild.members.fetch().catch(() => guild.members.cache);
    for (const member of members.values()) {
      if (member.user.bot) continue;
      rows.push({
        userID: member.user.id,
        guildID: guild.id,
        username: member.user.username,
        displayName: member.nickname ?? member.user.globalName ?? member.user.username,
        avatarURL: member.displayAvatarURL(),
      });
    }
  }

  if (rows.length === 0) return;
  await userMetaService.bulkUpsert(rows);

  // Group active IDs by guildID for efficient per-guild soft-delete
  const activeIDsByGuild = new Map<string, string[]>();
  for (const r of rows) {
    const list = activeIDsByGuild.get(r.guildID) ?? [];
    list.push(r.userID);
    activeIDsByGuild.set(r.guildID, list);
  }

  // Soft-delete members no longer in Discord (per guild)
  for (const guild of bot.guilds.cache.values()) {
    const activeIDs = activeIDsByGuild.get(guild.id) ?? [];
    await userMetaService.markDeletedExcept(guild.id, activeIDs).catch(() => undefined);
  }

  console.log(`[userMeta] ${rows.length} membre(s) seedé(s).`);
}

async function syncOverturnedAppeals(): Promise<void> {
  for (const guild of bot.guilds.cache.values()) {
    const result = await appealApiService.list(guild.id, { status: "overturned" }).catch(() => []);
    const appeals = Array.isArray(result) ? result : [];

    for (const appeal of appeals) {
      const sanction = await sanctionApiService.get(guild.id, appeal.sanctionID).catch(() => null);
      if (!sanction || sanction.state !== "created") continue;

      const member = await guild.members.fetch(sanction.userID).catch(() => null);
      if (member) {
        await member.timeout(null, "Appel accepte").catch(() => undefined);
      }
      await sanctionApiService.revoke(guild.id, sanction.id).catch(() => undefined);
    }
  }
}
