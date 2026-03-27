import { NextResponse } from "next/server";
import { getRulesByGuildID } from "@/services/channelRuleService";

export async function GET(_req: Request, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await params;
    return NextResponse.json(await getRulesByGuildID(guildId));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
