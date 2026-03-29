import { NextResponse } from "next/server";
import { getReport, updateReport } from "@/services/moderationReportService";

export async function GET(_request: Request, context: { params: Promise<{ guildId: string; reportId: string }> }) {
  try {
    const { guildId, reportId } = await context.params;
    const report = await getReport(guildId, reportId);
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ guildId: string; reportId: string }> }) {
  try {
    const { guildId, reportId } = await context.params;
    const body = await request.json();
    const updated = await updateReport(guildId, reportId, body);
    if (!updated) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
