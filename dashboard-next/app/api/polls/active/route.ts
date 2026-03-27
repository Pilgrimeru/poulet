import { NextResponse } from "next/server";
import { getAllActivePolls } from "@/services/pollService";

export async function GET() {
  try {
    return NextResponse.json(await getAllActivePolls());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
