import { NextResponse } from "next/server";
import { hydrateChannelValues } from "@/services/discordMetaService";
import {
  getMessageStatsOverview,
  getMessageStatsByChannel,
  getMessageStatsByUser,
  getVoiceStatsOverview,
  getVoiceStatsByChannel,
  getVoiceStatsByUser,
  getUserMetas,
} from "@/services/statsService";
import { getMemberStatsOverview } from "@/services/memberStatsService";

const MAX_HOURLY_RANGE_MS = 30 * 86400000;

export async function GET(req: Request, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await params;
    const url = new URL(req.url);
    const startDate = Number(url.searchParams.get("startDate"));
    const endDate = Number(url.searchParams.get("endDate"));
    const includeHourTimeline = endDate - startDate <= MAX_HOURLY_RANGE_MS;

    const [
      msgOverview,
      msgByChannelRaw,
      msgByUserRaw,
      voiceOverview,
      voiceByChannelRaw,
      voiceByUserRaw,
      memberOverview,
    ] = await Promise.all([
      getMessageStatsOverview(guildId, startDate, endDate, { includeHourly: true, includeHourTimeline }),
      getMessageStatsByChannel(guildId, startDate, endDate),
      getMessageStatsByUser(guildId, startDate, endDate),
      getVoiceStatsOverview(guildId, startDate, endDate, { includeHourly: true, includeHourTimeline }),
      getVoiceStatsByChannel(guildId, startDate, endDate),
      getVoiceStatsByUser(guildId, startDate, endDate),
      getMemberStatsOverview(guildId, startDate, endDate, { includeHourly: true, includeHourTimeline }),
    ]);

    const allUserIDs = [
      ...new Set([
        ...msgByUserRaw.map((r) => r.userID),
        ...voiceByUserRaw.map((r) => r.userID),
      ]),
    ];

    const [msgByChannel, voiceByChannel, userMetas] = await Promise.all([
      hydrateChannelValues(guildId, msgByChannelRaw),
      hydrateChannelValues(guildId, voiceByChannelRaw),
      getUserMetas(guildId, allUserIDs),
    ]);

    const msgByUser = msgByUserRaw.map((r) => ({ ...r, ...(userMetas.get(r.userID) ?? {}) }));
    const voiceByUser = voiceByUserRaw.map((r) => ({ ...r, ...(userMetas.get(r.userID) ?? {}) }));

    return NextResponse.json({
      msgOverview,
      msgByChannel,
      msgByUser,
      voiceOverview,
      voiceByChannel,
      voiceByUser,
      memberOverview,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
