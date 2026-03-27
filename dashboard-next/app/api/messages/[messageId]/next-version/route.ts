import { NextResponse } from "next/server";
import { getNextVersion } from "@/services/messageSnapshotService";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const { messageId } = await params;
    const version = await getNextVersion(messageId);
    return NextResponse.json({ version });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
