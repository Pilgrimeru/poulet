import { NextResponse } from "next/server";
import { removeAllParticipations } from "@/services/pollService";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ pollId: string }> },
) {
  try {
    const { pollId } = await params;
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") ?? "";
    const deleted = await removeAllParticipations(pollId, userId);
    return NextResponse.json({ deleted });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
