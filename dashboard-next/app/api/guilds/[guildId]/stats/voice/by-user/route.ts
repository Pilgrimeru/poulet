import { NextResponse } from "next/server";
import { getVoiceStatsByUser, getUserMetas } from "@/services/statsService";

export async function GET(req: Request, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await params;
    const url = new URL(req.url);
    const startDate = Number(url.searchParams.get("startDate"));
    const endDate = Number(url.searchParams.get("endDate"));
    const rows = await getVoiceStatsByUser(guildId, startDate, endDate);
    const userIDs = rows.map((r) => r.userID);
    const metas = await getUserMetas(guildId, userIDs);
    return NextResponse.json(rows.map((r) => ({ ...r, ...(metas.get(r.userID) ?? {}) })));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
