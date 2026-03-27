import { NextResponse } from "next/server";
import { getRuleByID } from "@/services/channelRuleService";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ guildId: string; id: string }> },
) {
  try {
    const { guildId, id } = await params;
    const rule = await getRuleByID(guildId, id);
    return rule ? NextResponse.json(rule) : NextResponse.json(null, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
