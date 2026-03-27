import { NextResponse } from "next/server";
import { markDeleted } from "@/services/messageSnapshotService";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const { messageId } = await params;
    await markDeleted(messageId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
