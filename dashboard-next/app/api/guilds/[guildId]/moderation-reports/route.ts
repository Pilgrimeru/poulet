import { NextResponse } from "next/server";
import { createReport, getReportByChannel, listReports } from "@/services/moderationReportService";

export async function GET(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    const { searchParams } = new URL(request.url);
    const channelID = searchParams.get("channelId");
    if (channelID) {
      return NextResponse.json(await getReportByChannel(guildId, channelID));
    }
    return NextResponse.json(
      await listReports(guildId, {
        appealStatus: searchParams.get("appealStatus") ?? undefined,
        status: searchParams.get("status") ?? undefined,
      }),
    );
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    const body = await request.json();
    return NextResponse.json(await createReport({ ...body, guildID: guildId }));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
