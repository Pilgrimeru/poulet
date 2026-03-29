import { NextResponse } from "next/server";
import { revokeWarn } from "@/services/warnService";

export async function PATCH(_request: Request, context: { params: Promise<{ guildId: string; warnId: string }> }) {
  try {
    const { guildId, warnId } = await context.params;
    const warn = await revokeWarn(guildId, warnId);
    if (!warn) return NextResponse.json({ error: "Warn not found" }, { status: 404 });
    return NextResponse.json(warn);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
