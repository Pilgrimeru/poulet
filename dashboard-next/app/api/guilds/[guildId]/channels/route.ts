import { NextResponse } from "next/server";
import { hydrateChannelEntries } from "@/services/discordMetaService";
import { getDistinctChannels } from "@/services/messageSnapshotService";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const { guildId } = await params;
    const channels = await getDistinctChannels(guildId);
    return NextResponse.json(await hydrateChannelEntries(guildId, channels));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
