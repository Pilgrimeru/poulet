import { NextResponse } from "next/server";
import { bulkSeedJoins, recordMemberEvent } from "@/services/memberStatsService";
import { MemberEvent } from "@/models/MemberEvent";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const guildID = searchParams.get("guildID");
    const userID = searchParams.get("userID");
    if (!guildID || !userID) {
      return NextResponse.json({ error: "Missing guildID or userID" }, { status: 400 });
    }
    const count = await MemberEvent.count({ where: { guildID, userID, type: "join" } } as any);
    return NextResponse.json({ joinCount: count });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

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
