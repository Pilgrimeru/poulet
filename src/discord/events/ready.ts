import { ActivityType } from "discord.js";
import { startStatsReportScheduler } from "@/discord/components";
import { bot } from "@/app/runtime";
import { registerPollHandlers } from "@/discord/interactions";
import { Event } from "@/discord/types";

export default new Event("clientReady", () => {
  console.log(`${bot.user!.username} ready!`);
  void bot.startSessionsForGuildMembers();
  void bot.startPollExpiration();
  startStatsReportScheduler();
  registerPollHandlers();

  bot.user!.setActivity(`/help`, { type: ActivityType.Listening });
  setInterval(() => {
    bot.user!.setActivity(`/help`, { type: ActivityType.Listening });
  }, 3600 * 1000);
});
