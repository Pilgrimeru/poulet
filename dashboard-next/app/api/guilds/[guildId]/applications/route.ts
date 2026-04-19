import { NextResponse } from "next/server";
import { createForm, listForms } from "@/services/applicationFormService";
import type { Question, QuestionType } from "@/services/applicationFormService";

const VALID_TYPES: QuestionType[] = ["open_text", "single_choice", "multiple_choice"];

function validateQuestion(q: unknown, index: number): string | null {
  if (!q || typeof q !== "object") return `Question ${index}: doit être un objet`;
  const obj = q as Record<string, unknown>;
  if (typeof obj["id"] !== "string" || !obj["id"]) return `Question ${index}: id manquant`;
  if (typeof obj["label"] !== "string" || !obj["label"]) return `Question ${index}: label manquant`;
  if (!VALID_TYPES.includes(obj["type"] as QuestionType)) return `Question ${index}: type invalide`;
  if (obj["type"] !== "open_text") {
    if (!Array.isArray(obj["options"]) || (obj["options"] as unknown[]).length === 0)
      return `Question ${index}: options requises pour ce type`;
  }
  return null;
}

export async function GET(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    const { searchParams } = new URL(request.url);
    const isActiveParam = searchParams.get("isActive");
    const isActive = isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;
    return NextResponse.json(await listForms(guildId, { isActive }));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    const body = await request.json();
    const { name, description, questions, acceptRoleIDs, removeRoleIDs, rejectRoleIDs,
      welcomeChannelID, submissionChannelID, cooldownMs, sessionTimeoutMs, isActive } =
      body as Record<string, unknown>;

    if (typeof name !== "string" || !name.trim())
      return NextResponse.json({ error: "name requis" }, { status: 400 });

    const parsedQuestions = Array.isArray(questions) ? (questions as unknown[]) : [];
    if (parsedQuestions.length > 25)
      return NextResponse.json({ error: "Maximum 25 questions" }, { status: 400 });

    for (let i = 0; i < parsedQuestions.length; i++) {
      const err = validateQuestion(parsedQuestions[i], i + 1);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    const form = await createForm(guildId, {
      name: String(name).trim(),
      description: typeof description === "string" ? description : undefined,
      questions: parsedQuestions as Question[],
      acceptRoleIDs: Array.isArray(acceptRoleIDs) ? (acceptRoleIDs as string[]) : undefined,
      removeRoleIDs: Array.isArray(removeRoleIDs) ? (removeRoleIDs as string[]) : undefined,
      rejectRoleIDs: Array.isArray(rejectRoleIDs) ? (rejectRoleIDs as string[]) : undefined,
      welcomeChannelID: typeof welcomeChannelID === "string" ? welcomeChannelID : null,
      submissionChannelID: typeof submissionChannelID === "string" ? submissionChannelID : null,
      cooldownMs: typeof cooldownMs === "number" ? cooldownMs : undefined,
      sessionTimeoutMs: typeof sessionTimeoutMs === "number" ? sessionTimeoutMs : undefined,
      isActive: typeof isActive === "boolean" ? isActive : undefined,
    });

    return NextResponse.json(form, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
