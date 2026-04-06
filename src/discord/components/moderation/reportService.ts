import type { SummaryResult } from "@/ai";
import { summarizeReport } from "@/ai";
import { flaggedMessageApiService, moderationReportApiService } from "@/api";
import { collectTicketMessages, ticketMessagesToTranscript } from "./ticketTranscript";
import type { Guild, TextChannel } from "discord.js";

export async function getAlreadySanctionedMessageIDs(guildID: string, targetUserID: string): Promise<Set<string>> {
  const [flags, reports] = await Promise.all([
    flaggedMessageApiService.list(guildID, { targetUserID, status: "sanctioned" }).catch(() => []),
    moderationReportApiService.list(guildID, { status: "sanctioned" }).catch(() => []),
  ]);

  const messageIDs = new Set<string>();

  for (const flag of flags) {
    if (flag.targetUserID !== targetUserID || !flag.sanctionID) continue;
    if (flag.messageID) messageIDs.add(flag.messageID);
    for (const message of flag.context ?? []) {
      if (message.authorID === targetUserID && message.id) messageIDs.add(message.id);
    }
  }

  for (const report of reports) {
    if (report.targetUserID !== targetUserID || !report.sanctionID) continue;
    for (const message of report.context?.messages ?? []) {
      if (message.authorID === targetUserID && message.id) messageIDs.add(message.id);
    }
  }

  return messageIDs;
}

export async function processTicketAnalysis(
  guild: Guild,
  channel: TextChannel,
  opts: { reporterID: string; targetUserID: string },
): Promise<{ reportId: string; summary: SummaryResult }> {
  const [ticketMessages, sanctionedMessageIDs] = await Promise.all([
    collectTicketMessages(channel),
    getAlreadySanctionedMessageIDs(guild.id, opts.targetUserID),
  ]);
  const transcript = await ticketMessagesToTranscript(guild, ticketMessages);
  const anchorTimestamp = ticketMessages[0]?.createdAt ?? Date.now();

  const existingReport = await moderationReportApiService.getByChannel(guild.id, channel.id);
  const report = existingReport
    ? await moderationReportApiService.update(guild.id, existingReport.id, {
        reporterSummary: transcript,
        status: "awaiting_ai",
        context: { messages: ticketMessages, aiSummary: existingReport.context?.aiSummary },
      })
    : await moderationReportApiService.create({
        guildID: guild.id,
        reporterID: opts.reporterID,
        targetUserID: opts.targetUserID,
        ticketChannelID: channel.id,
        status: "awaiting_ai",
        reporterSummary: transcript,
        context: { messages: ticketMessages },
      });

  const summary = await summarizeReport({
    guildID: guild.id,
    reporterID: opts.reporterID,
    targetUserID: opts.targetUserID,
    transcript,
    anchorTimestamp,
    sanctionedMessageIDs,
  });

  await moderationReportApiService.update(guild.id, report.id, {
    status: summary.needsFollowUp ? "awaiting_reporter" : "awaiting_confirmation",
    context: { messages: ticketMessages, aiSummary: summary },
  });

  return { reportId: report.id, summary };
}
