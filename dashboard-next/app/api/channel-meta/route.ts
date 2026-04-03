import { NextResponse } from "next/server";
import { markChannelDeleted, markChannelsDeletedExcept, upsertChannelMeta, upsertChannelMetas } from "@/services/channelMetaService";

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

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    if (body?.guildID && Array.isArray(body?.activeChannelIDs)) {
      await markChannelsDeletedExcept(body.guildID, body.activeChannelIDs);
    } else if (body?.channelID) {
      await markChannelDeleted(body.channelID);
    } else {
      return NextResponse.json({ error: "Missing channelID or guildID+activeChannelIDs" }, { status: 400 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
