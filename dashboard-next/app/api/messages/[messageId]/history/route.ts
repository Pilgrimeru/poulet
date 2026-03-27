import { NextResponse } from "next/server";
import { getMessageHistory } from "@/services/messageSnapshotService";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const { messageId } = await params;
    return NextResponse.json(await getMessageHistory(messageId));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
