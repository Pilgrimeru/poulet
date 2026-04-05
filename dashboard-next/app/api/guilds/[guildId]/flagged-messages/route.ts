import { NextResponse } from "next/server";
import { createFlaggedMessage, listFlaggedMessages } from "@/services/flaggedMessageService";

export async function GET(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    const { searchParams } = new URL(request.url);
    return NextResponse.json(
      await listFlaggedMessages(guildId, {
        targetUserID: searchParams.get("targetUserId") ?? undefined,
        status: searchParams.get("status") ?? undefined,
        limit: Number(searchParams.get("limit") ?? 50),
        offset: Number(searchParams.get("offset") ?? 0),
      }),
    );
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    const body = await request.json();
    return NextResponse.json(await createFlaggedMessage({ ...body, guildID: guildId }));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
