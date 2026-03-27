import { NextResponse } from "next/server";
import { upsertChannelMeta } from "@/services/channelMetaService";

export async function POST(req: Request) {
  try {
    const { channelID, guildID, name, parentID, parentName, channelType } = await req.json();
    await upsertChannelMeta(channelID, guildID, name, parentID, parentName, channelType);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
