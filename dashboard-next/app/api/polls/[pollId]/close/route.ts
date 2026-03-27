import { NextResponse } from "next/server";
import { closePoll } from "@/services/pollService";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ pollId: string }> },
) {
  try {
    const { pollId } = await params;
    await closePoll(pollId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
