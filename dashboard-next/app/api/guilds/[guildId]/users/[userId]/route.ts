import { NextResponse } from "next/server";
import { getCurrentUserMeta } from "@/services/discordMetaService";

export async function GET(_request: Request, context: { params: Promise<{ guildId: string; userId: string }> }) {
  try {
    const { guildId, userId } = await context.params;
    const meta = await getCurrentUserMeta(guildId, userId);
    if (!meta) {
      return NextResponse.json({ userID: userId, username: "", displayName: "", avatarURL: "" });
    }
    return NextResponse.json(meta);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
