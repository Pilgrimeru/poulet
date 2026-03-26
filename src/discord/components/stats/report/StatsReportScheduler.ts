import { bot } from "@/app/runtime";
import { guildSettingsService, statsReportMessageStateService } from "@/api";
import { StatsTableBuilder } from "@/discord/components";
import { TopTableData } from "@/discord/types";
import { TableImageGenerator } from "@/image-generator";
import { Guild, TextBasedChannel } from "discord.js";
import cron from "node-cron";
import { unlinkSync } from "node:fs";

type StatsAutoFrequency = "disabled" | "daily" | "weekly" | "monthly";

export function startStatsReportScheduler() {
  return;
}

cron.schedule("0 0 * * *", sendScheduledStatsReports);

async function sendScheduledStatsReports() {
  for (const guild of bot.guilds.cache.values()) {
    await sendStatsReportForTarget(guild.id);
  }
}

async function sendStatsReportForTarget(guildID: string) {
  const guild = resolveGuild(guildID);
  if (!guild) return;

  const guildSettings = await guildSettingsService.getByGuildID(guild.id);
  if (!shouldSendToday(guildSettings.statsAutoFrequency)) return;
  const channel = resolveChannel(guild, guildSettings.statsReportChannelID);
  if (!channel?.isTextBased()) return;

  const [start, end] = calculateDateRange(guildSettings.statsAutoFrequency);
  const tableData = await StatsTableBuilder.createTopTableData(start, end, guild, {
    blacklistChannel: guildSettings.statsBlacklistChannelIDs,
    allowDeaf: guildSettings.statsCountDeafTime,
    rankingPreference: guildSettings.statsRankingPreference,
  });

  channel.sendTyping();

  const imgName = await generateImage(guild.id, tableData);

  await sendMessage(
    guild.id,
    channel,
    imgName,
    start,
    end,
    guildSettings.statsAutoFrequency,
  );

  unlinkSync(`cache/${imgName}`);
}

function resolveGuild(guildId: string) {
  const guild = bot.guilds.resolve(guildId);
  if (!guild) console.log("serveur introuvable");
  return guild ?? undefined;
}

function resolveChannel(guild: Guild, channelId: string) {
  const channel = guild.channels.resolve(channelId);
  if (!channel) console.log("channel introuvable");
  return channel ?? undefined;
}

function shouldSendToday(frequency: StatsAutoFrequency): boolean {
  const now = new Date();
  if (frequency === "disabled") return false;
  if (frequency === "daily") return true;
  if (frequency === "weekly") return now.getDay() === 1;
  return now.getDate() === 1;
}

function calculateDateRange(frequency: StatsAutoFrequency) {
  const currentDate = new Date();

  if (frequency === "daily") {
    const end = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate(),
    ).getTime();
    const start = end - 24 * 60 * 60 * 1000;
    return [start, end];
  }

  if (frequency === "weekly") {
    const day = currentDate.getDay();
    const mondayOffset = day === 0 ? 6 : day - 1;
    const end = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate() - mondayOffset,
    ).getTime();
    const start = end - 7 * 24 * 60 * 60 * 1000;
    return [start, end];
  }

  const end = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getTime();
  const start = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() - 1,
    1,
  ).getTime();
  return [start, end];
}

async function generateImage(guildId: string, tableData: TopTableData) {
  const imgName = "table-stats_" + guildId + ".png";
  await new TableImageGenerator().createImage(tableData, imgName);
  return imgName;
}

async function sendMessage(
  guildID: string,
  channel: TextBasedChannel,
  imgName: string,
  start: number,
  end: number,
  frequency: StatsAutoFrequency,
) {
  const startMonth = new Date(start).toLocaleString("fr-FR", { month: "long" });
  const startDate = new Date(start).toLocaleDateString("fr-FR");
  const endDate = new Date(end - 60000).toLocaleDateString("fr-FR");
  const nextLabel =
    frequency === "daily"
      ? "Jour suivant"
      : frequency === "weekly"
        ? "Semaine suivante"
        : "Mois suivant";

  const title =
    frequency === "monthly"
      ? `__Stats du **1 ${startMonth}** au **${new Date(end - 60000).getDate()} ${startMonth}** :__`
      : `__Stats du **${startDate}** au **${endDate}** :__`;

  const messageContent = {
    content: `${title}\n\n__${nextLabel}__ :\n*indisponible*`,
    files: [`cache/${imgName}`],
  };

  const previousMessage = await fetchPreviousMessage(guildID, channel);

  if (previousMessage) {
    const newMessage = await previousMessage
      .reply(messageContent)
      .catch(console.error);

    if (newMessage) {
      const newContent = previousMessage.content.replace(
        "*indisponible*",
        newMessage.url,
      );
      if (previousMessage.author.id === bot.user?.id) {
        previousMessage.edit({ content: newContent });
      }

      await updatePreviousMessageId(guildID, newMessage.id);
    }
  } else {
    console.log("message introuvable");

    const newMessage = await (channel as any)
      .send(messageContent)
      .catch(console.error);
    if (newMessage) await updatePreviousMessageId(guildID, newMessage.id);
  }
}

async function fetchPreviousMessage(guildID: string, channel: TextBasedChannel) {
  const previousMessageId = await statsReportMessageStateService.getMessageID(guildID);
  return previousMessageId
    ? await channel.messages.fetch(previousMessageId).catch(console.error)
    : undefined;
}

async function updatePreviousMessageId(guildID: string, newId: string) {
  try {
    await statsReportMessageStateService.upsertState({
      guildID,
      messageID: newId,
    });
  } catch (error) {
    console.error(error);
  }
}
