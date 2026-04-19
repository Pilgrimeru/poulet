import { NextResponse } from "next/server";
import { listPendingRoleProcessing } from "@/services/applicationSubmissionService";

export async function GET(_request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    return NextResponse.json(await listPendingRoleProcessing(guildId));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
