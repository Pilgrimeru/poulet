import { NextResponse } from "next/server";
import { getRuleByChannel } from "@/services/channelRuleService";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ guildId: string; channelID: string }> },
) {
  try {
    const { guildId, channelID } = await params;
    const rule = await getRuleByChannel(guildId, channelID);
    return rule ? NextResponse.json(rule) : NextResponse.json(null, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
