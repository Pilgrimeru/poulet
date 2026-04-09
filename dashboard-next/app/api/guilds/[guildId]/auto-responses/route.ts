import { NextResponse } from "next/server";
import { getAutoResponsesByGuildID, createAutoResponse } from "@/services/autoResponseService";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const { guildId } = await params;
    return NextResponse.json(await getAutoResponsesByGuildID(guildId));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const { guildId } = await params;
    const body = await req.json();
    const rule = await createAutoResponse(guildId, body);
    return NextResponse.json(rule, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
