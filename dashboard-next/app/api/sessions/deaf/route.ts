import { NextResponse } from "next/server";
import { createDeafSession, getDeafSessionsInIntersection } from "@/services/sessionService";

export async function POST(req: Request) {
  try {
    await createDeafSession(await req.json());
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const guildID = url.searchParams.get("guildID") ?? "";
    const start = Number(url.searchParams.get("start"));
    const end = Number(url.searchParams.get("end"));
    return NextResponse.json(await getDeafSessionsInIntersection(guildID, start, end));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
