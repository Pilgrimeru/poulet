import { NextResponse } from "next/server";
import { createWarn, listWarns } from "@/services/warnService";

export async function GET(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    const { searchParams } = new URL(request.url);
    const userID = searchParams.get("userId") ?? undefined;
    return NextResponse.json(await listWarns(guildId, userID));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    const body = await request.json();
    return NextResponse.json(await createWarn({ ...body, guildID: guildId }));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
