import { ActivityType } from "discord.js";
import { startStatsReportScheduler } from "@/discord/components";
import { bot } from "@/app/runtime";
import { registerPollHandlers } from "@/discord/interactions";
import { channelMetaService, guildMetaService, messageSnapshotService } from "@/database/services";
import { Event } from "@/discord/types";

export default new Event("clientReady", () => {
  console.log(`${bot.user!.username} ready!`);

  // Seed guild & channel metadata from Discord cache
  void (async () => {
    for (const guild of bot.guilds.cache.values()) {
      await guildMetaService.upsert(guild.id, guild.name, guild.iconURL() ?? "");
      for (const channel of guild.channels.cache.values()) {
        if ("name" in channel && channel.name) {
          await channelMetaService.upsert(channel.id, guild.id, channel.name);
        }
      }
    }
  })();
  void bot.startSessionsForGuildMembers();
  void bot.startPollExpiration();
  startStatsReportScheduler();
  registerPollHandlers();

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
