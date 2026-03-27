import { NextResponse } from "next/server";
import { hydrateGuildEntries } from "@/services/discordMetaService";
import { getDistinctGuilds } from "@/services/messageSnapshotService";

export async function GET() {
  try {
    const guilds = await getDistinctGuilds();
    return NextResponse.json(await hydrateGuildEntries(guilds));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
