import { NextResponse } from "next/server";
import { updateFlaggedMessage } from "@/services/flaggedMessageService";

export async function PATCH(request: Request, context: { params: Promise<{ guildId: string; flagId: string }> }) {
  try {
    const { guildId, flagId } = await context.params;
    const body = await request.json();
    const updated = await updateFlaggedMessage(guildId, flagId, body);
    if (!updated) return NextResponse.json({ error: "Flagged message not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
