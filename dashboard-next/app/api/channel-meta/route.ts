import { NextResponse } from "next/server";
import { upsertChannelMeta, upsertChannelMetas } from "@/services/channelMetaService";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (Array.isArray(body?.rows)) {
      await upsertChannelMetas(body.rows);
    } else {
      const { channelID, guildID, name, parentID, parentName, channelType } = body;
      await upsertChannelMeta(channelID, guildID, name, parentID, parentName, channelType);
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
