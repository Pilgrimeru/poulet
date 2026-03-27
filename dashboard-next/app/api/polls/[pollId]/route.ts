import { NextResponse } from "next/server";
import { getPoll, deletePoll } from "@/services/pollService";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pollId: string }> },
) {
  try {
    const { pollId } = await params;
    const poll = await getPoll(pollId);
    return poll ? NextResponse.json(poll) : NextResponse.json(null, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ pollId: string }> },
) {
  try {
    const { pollId } = await params;
    await deletePoll(pollId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
