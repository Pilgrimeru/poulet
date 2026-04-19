import { NextResponse } from "next/server";
import {
  createSubmission,
  listSubmissions,
  getActiveSubmissionForUser,
} from "@/services/applicationSubmissionService";
import type { SubmissionStatus } from "@/services/applicationSubmissionService";
import { getForm } from "@/services/applicationFormService";

type Ctx = { params: Promise<{ guildId: string; formId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const { guildId, formId } = await context.params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as SubmissionStatus | null;
    const userID = searchParams.get("userId") ?? undefined;
    const limit = Number(searchParams.get("limit") ?? 50);
    const offset = Number(searchParams.get("offset") ?? 0);
    return NextResponse.json(await listSubmissions(guildId, formId, {
      status: status ?? undefined,
      userID,
      limit,
      offset,
    }));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request, context: Ctx) {
  try {
    const { guildId, formId } = await context.params;
    const body = await request.json();
    const { userID, answers } = body as Record<string, unknown>;

    if (typeof userID !== "string" || !userID)
      return NextResponse.json({ error: "userID requis" }, { status: 400 });
    if (!answers || typeof answers !== "object" || Array.isArray(answers))
      return NextResponse.json({ error: "answers invalides" }, { status: 400 });

    const form = await getForm(guildId, formId);
    if (!form) return NextResponse.json({ error: "Formulaire introuvable" }, { status: 404 });

    // Enforce one-active-application rule
    const existing = await getActiveSubmissionForUser(guildId, formId, userID);
    if (existing) return NextResponse.json({ error: "active_submission_exists" }, { status: 409 });

    const submission = await createSubmission(formId, guildId, {
      userID,
      answers: answers as Record<string, string | string[]>,
    });
    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
