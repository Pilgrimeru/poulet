import { NextResponse } from "next/server";
import { getDistinctChannels } from "@/services/messageSnapshotService";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const { guildId } = await params;
    return NextResponse.json(await getDistinctChannels(guildId));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
