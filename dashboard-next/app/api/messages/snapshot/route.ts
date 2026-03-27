import { NextResponse } from "next/server";
import { saveSnapshot } from "@/services/messageSnapshotService";

export async function POST(req: Request) {
  try {
    const { data, attachments, version, isDeleted } = await req.json();
    await saveSnapshot(data, attachments ?? [], version ?? 0, isDeleted ?? false);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
