import { NextResponse } from "next/server";
import { createAppeal, listAppeals } from "@/services/appealService";
import type { AppealStatus } from "@/services/appealService";
import { Sanction } from "@/models/Sanction";

export async function GET(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    const { searchParams } = new URL(request.url);
    return NextResponse.json(
      await listAppeals(guildId, {
        sanctionID: searchParams.get("sanctionId") ?? undefined,
        status: (searchParams.get("status") ?? undefined) as AppealStatus | undefined,
      }),
    );
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    const body = await request.json();
    const { sanctionID, text } = body as { sanctionID?: unknown; text?: unknown };

    if (typeof sanctionID !== "string" || sanctionID.trim() === "") {
      return NextResponse.json({ error: "Invalid sanctionID" }, { status: 400 });
    }
    if (typeof text !== "string" || text.trim() === "") {
      return NextResponse.json({ error: "Invalid text" }, { status: 400 });
    }

    const sanction = await Sanction.findOne({ where: { id: sanctionID, guildID: guildId } });
    if (!sanction) {
      return NextResponse.json({ error: "Sanction not found" }, { status: 404 });
    }

    return NextResponse.json(await createAppeal(sanctionID, text));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
