import { NextResponse } from "next/server";
import { upsertGuildMeta } from "@/services/guildMetaService";

export async function POST(req: Request) {
  try {
    const { guildID, name, iconURL } = await req.json();
    await upsertGuildMeta(guildID, name, iconURL);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
