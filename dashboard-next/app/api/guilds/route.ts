import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hydrateGuildEntries, listGuildEntriesFromDiscord } from "@/services/discordMetaService";
import { getDistinctGuilds } from "@/services/messageSnapshotService";

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const discordGuilds = await listGuildEntriesFromDiscord(session.guildIDs);
    if (discordGuilds.length > 0) {
      return NextResponse.json(discordGuilds);
    }

    const guilds = await getDistinctGuilds();
    return NextResponse.json(await hydrateGuildEntries(guilds));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
