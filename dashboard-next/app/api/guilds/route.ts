import { NextResponse } from "next/server";
import { getDistinctGuilds } from "@/services/messageSnapshotService";

export async function GET() {
  try {
    return NextResponse.json(await getDistinctGuilds());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
