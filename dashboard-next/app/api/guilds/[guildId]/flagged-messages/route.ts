import { NextResponse } from "next/server";
import { createFlaggedMessage, listFlaggedMessages } from "@/services/flaggedMessageService";

export async function GET(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    const { searchParams } = new URL(request.url);
    return NextResponse.json(
      await listFlaggedMessages(guildId, {
        targetUserID: searchParams.get("targetUserId") ?? undefined,
        appealStatus: searchParams.get("appealStatus") ?? undefined,
        status: searchParams.get("status") ?? undefined,
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
