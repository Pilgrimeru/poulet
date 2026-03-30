import { ActivityType } from "discord.js";
import { startStatsReportScheduler } from "@/discord/components";
import { bot } from "@/app/runtime";
import { registerPollHandlers } from "@/discord/interactions";
import { appealApiService, channelMetaService, guildMetaService, messageSnapshotService, sanctionApiService } from "@/api";
import { cacheGuildInvites } from "@/services/inviteTrackerService";
import { Event } from "@/discord/types";

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
  })();
  for (const guild of bot.guilds.cache.values()) {
    void cacheGuildInvites(guild);
  }
  void bot.startSessionsForGuildMembers();
  void bot.startPollExpiration();
  startStatsReportScheduler();
  registerPollHandlers();
  void syncOverturnedAppeals();
  setInterval(() => void syncOverturnedAppeals(), 60_000);

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

async function syncOverturnedAppeals(): Promise<void> {
  for (const guild of bot.guilds.cache.values()) {
    const appeals = await appealApiService.list(guild.id, { status: "overturned" }).catch(() => []);

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
