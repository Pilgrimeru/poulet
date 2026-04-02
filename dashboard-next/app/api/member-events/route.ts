import { NextResponse } from "next/server";
import { bulkSeedJoins, recordMemberEvent } from "@/services/memberStatsService";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.bulk === true) {
      await bulkSeedJoins(body.events);
    } else {
      await recordMemberEvent(body.guildID, body.userID, body.type, body.date);
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
