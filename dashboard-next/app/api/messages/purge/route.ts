import { NextResponse } from "next/server";
import { purgeOldSnapshots } from "@/services/messageSnapshotService";

export async function POST() {
  try {
    const deleted = await purgeOldSnapshots();
    return NextResponse.json({ deleted });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
