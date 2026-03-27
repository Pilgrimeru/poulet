import { NextResponse } from "next/server";
import {
  createMessageHistory,
  getLatestByUserInChannel,
  countGuildMessagesBetweenDatesByUserAndChannel,
} from "@/services/messageHistoryService";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await createMessageHistory(body);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const guildID = url.searchParams.get("guildID") ?? "";

    if (type === "count") {
      const startDate = Number(url.searchParams.get("startDate"));
      const endDate = Number(url.searchParams.get("endDate"));
      return NextResponse.json(
        await countGuildMessagesBetweenDatesByUserAndChannel(guildID, startDate, endDate),
      );
    }

    // latest
    const userID = url.searchParams.get("userID") ?? "";
    const channelID = url.searchParams.get("channelID") ?? "";
    const result = await getLatestByUserInChannel(guildID, userID, channelID);
    return result ? NextResponse.json(result) : NextResponse.json(null, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
