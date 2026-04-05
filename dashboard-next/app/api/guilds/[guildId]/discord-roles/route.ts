import { NextResponse } from "next/server";
import { listGuildRolesFromDiscord } from "@/services/discordMetaService";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const { guildId } = await params;
    const roles = await listGuildRolesFromDiscord(guildId);
    return NextResponse.json(roles);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
