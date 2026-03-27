import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hydrateGuildEntries } from "@/services/discordMetaService";
import { getDistinctGuilds } from "@/services/messageSnapshotService";

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const guilds = await getDistinctGuilds();
    const allowedGuildIDs = new Set(session.guildIDs);
    const visibleGuilds = guilds.filter((guild) => allowedGuildIDs.has(guild.guildID));
    return NextResponse.json(await hydrateGuildEntries(visibleGuilds));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
