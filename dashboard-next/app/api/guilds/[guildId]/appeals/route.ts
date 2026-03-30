import { NextResponse } from "next/server";
import { createAppeal, listAppeals } from "@/services/appealService";
import type { AppealStatus } from "@/services/appealService";

export async function GET(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    const { searchParams } = new URL(request.url);
    return NextResponse.json(
      await listAppeals(guildId, {
        sanctionID: searchParams.get("sanctionId") ?? undefined,
        status: (searchParams.get("status") ?? undefined) as AppealStatus | undefined,
      }),
    );
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    await context.params;
    const body = await request.json();
    const { sanctionID, text } = body as { sanctionID: string; text: string };
    return NextResponse.json(await createAppeal(sanctionID, text));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
