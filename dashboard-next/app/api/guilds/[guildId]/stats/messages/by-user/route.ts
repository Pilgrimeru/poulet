import { NextResponse } from "next/server";
import { hydrateUserMetas } from "@/services/discordMetaService";
import { getMessageStatsByUser, getUserMetas } from "@/services/statsService";

export async function GET(req: Request, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await params;
    const url = new URL(req.url);
    const startDate = Number(url.searchParams.get("startDate"));
    const endDate = Number(url.searchParams.get("endDate"));
    const rows = await getMessageStatsByUser(guildId, startDate, endDate);
    const metas = await hydrateUserMetas(guildId, await getUserMetas(rows.map((r) => r.userID)));
    return NextResponse.json(rows.map((r) => ({ ...r, ...(metas.get(r.userID) ?? {}) })));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
