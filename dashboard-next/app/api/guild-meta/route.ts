import { NextResponse } from "next/server";
import { upsertGuildMeta, upsertGuildMetas } from "@/services/guildMetaService";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (Array.isArray(body?.rows)) {
      await upsertGuildMetas(body.rows);
    } else {
      const { guildID, name, iconURL } = body;
      await upsertGuildMeta(guildID, name, iconURL);
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
