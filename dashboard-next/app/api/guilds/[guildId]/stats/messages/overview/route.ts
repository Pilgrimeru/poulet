import { NextResponse } from "next/server";
import { getMessageStatsOverview } from "@/services/statsService";

export async function GET(req: Request, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await params;
    const url = new URL(req.url);
    const startDate = Number(url.searchParams.get("startDate"));
    const endDate = Number(url.searchParams.get("endDate"));
    return NextResponse.json(await getMessageStatsOverview(guildId, startDate, endDate));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
