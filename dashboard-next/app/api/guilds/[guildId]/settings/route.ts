import { NextResponse } from "next/server";
import { getByGuildID, updateByGuildID } from "@/services/guildSettingsService";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const { guildId } = await params;
    return NextResponse.json(await getByGuildID(guildId));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const { guildId } = await params;
    const body = await req.json();
    return NextResponse.json(await updateByGuildID(guildId, body));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
