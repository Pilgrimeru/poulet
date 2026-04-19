import { NextResponse } from "next/server";
import { getSubmission, updateSubmission } from "@/services/applicationSubmissionService";
import { getSessionFromCookies } from "@/lib/auth";

type Ctx = { params: Promise<{ guildId: string; formId: string; submissionId: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { guildId, submissionId } = await context.params;
    const submission = await getSubmission(guildId, submissionId);
    if (!submission) return NextResponse.json({ error: "Candidature introuvable" }, { status: 404 });
    return NextResponse.json(submission);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const { guildId, submissionId } = await context.params;
    const body = await request.json();
    const { status, reviewerNotes, rolesApplied } = body as Record<string, unknown>;

    const patch: Record<string, unknown> = {};

    // Dashboard review action
    if (status === "accepted" || status === "rejected") {
      const session = await getSessionFromCookies();
      patch["status"] = status;
      patch["reviewedAt"] = Date.now();
      patch["reviewedByUserID"] = session?.user?.id ?? null;
      if (reviewerNotes !== undefined) patch["reviewerNotes"] = reviewerNotes;
    }

    // Bot marks roles as applied
    if (typeof rolesApplied === "boolean") {
      patch["rolesApplied"] = rolesApplied;
    }

    if (Object.keys(patch).length === 0)
      return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });

    const updated = await updateSubmission(guildId, submissionId, patch as Parameters<typeof updateSubmission>[2]);
    if (!updated) return NextResponse.json({ error: "Candidature introuvable" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
