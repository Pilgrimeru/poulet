import { NextResponse } from "next/server";
import { getMessageID, upsertState } from "@/services/statsReportMessageStateService";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const { guildId } = await params;
    const id = await getMessageID(guildId);
    return NextResponse.json({ messageID: id ?? null });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const { guildId } = await params;
    const body = await req.json();
    await upsertState(guildId, body.messageID);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
