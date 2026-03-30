import { NextResponse } from "next/server";
import { updateAppeal } from "@/services/appealService";
import type { AppealStatus } from "@/services/appealService";

export async function PATCH(request: Request, context: { params: Promise<{ guildId: string; appealId: string }> }) {
  try {
    const { appealId } = await context.params;
    const body = await request.json();
    const updated = await updateAppeal(appealId, { status: body.status as AppealStatus });
    if (!updated) return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
