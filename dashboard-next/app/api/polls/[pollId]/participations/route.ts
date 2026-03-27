import { NextResponse } from "next/server";
import {
  addParticipation,
  removeParticipation,
  getUserParticipation,
  getUserParticipations,
  getAllParticipations,
} from "@/services/pollService";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ pollId: string }> },
) {
  try {
    const { pollId } = await params;
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") ?? undefined;
    const option = url.searchParams.get("option") ?? undefined;

    if (userId && option !== undefined) {
      const result = await getUserParticipation(pollId, userId, Number(option));
      return result ? NextResponse.json(result) : NextResponse.json(null, { status: 404 });
    }
    if (userId) {
      return NextResponse.json(await getUserParticipations(pollId, userId));
    }
    return NextResponse.json(await getAllParticipations(pollId));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ pollId: string }> },
) {
  try {
    const { pollId } = await params;
    const { userId, option } = await req.json();
    const result = await addParticipation(pollId, userId, Number(option));
    return result ? NextResponse.json(result) : NextResponse.json(null, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ pollId: string }> },
) {
  try {
    const { pollId } = await params;
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") ?? "";
    const option = url.searchParams.get("option") ?? "";
    const deleted = await removeParticipation(pollId, userId, Number(option));
    return NextResponse.json({ deleted });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
