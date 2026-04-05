import { NextResponse } from "next/server";
import { createSanction, listSanctions } from "@/services/sanctionService";

export async function GET(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    const { searchParams } = new URL(request.url);
    const userID = searchParams.get("userId") ?? undefined;
    const state = (searchParams.get("state") ?? undefined) as "created" | "canceled" | undefined;
    const limit = Number(searchParams.get("limit") ?? 50);
    const offset = Number(searchParams.get("offset") ?? 0);
    return NextResponse.json(await listSanctions(guildId, userID, { state, limit, offset }));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    const body = await request.json();
    return NextResponse.json(await createSanction({ ...body, guildID: guildId }));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
