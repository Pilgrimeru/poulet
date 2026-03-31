import { NextResponse } from "next/server";
import { listGuildChannelsFromDiscord } from "@/services/discordMetaService";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const { guildId } = await params;
    const channels = await listGuildChannelsFromDiscord(guildId);
    return NextResponse.json(channels);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
