import { NextResponse } from "next/server";
import { createPoll } from "@/services/pollService";

export async function POST(req: Request) {
  try {
    const poll = await createPoll(await req.json());
    return NextResponse.json(poll, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
