import { NextResponse } from "next/server";
import { revokeSanction, updateSanction } from "@/services/sanctionService";

export async function PATCH(request: Request, context: { params: Promise<{ guildId: string; sanctionId: string }> }) {
  try {
    const { guildId, sanctionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const sanction = Object.keys(body).length === 0
      ? await revokeSanction(guildId, sanctionId)
      : await updateSanction(guildId, sanctionId, body);
    if (!sanction) return NextResponse.json({ error: "Sanction not found" }, { status: 404 });
    return NextResponse.json(sanction);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
