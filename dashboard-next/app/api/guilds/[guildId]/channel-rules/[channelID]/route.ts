import { NextResponse } from "next/server";
import { upsertRule, deleteRule } from "@/services/channelRuleService";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ guildId: string; channelID: string }> },
) {
  try {
    const { guildId, channelID } = await params;
    const body = await req.json();
    const rule = await upsertRule(guildId, channelID, body);
    return NextResponse.json(rule);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ guildId: string; channelID: string }> },
) {
  try {
    const { guildId, channelID } = await params;
    const deleted = await deleteRule(guildId, channelID);
    return NextResponse.json({ deleted });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
