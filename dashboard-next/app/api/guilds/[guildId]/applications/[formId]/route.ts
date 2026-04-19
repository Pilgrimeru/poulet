import { NextResponse } from "next/server";
import { getForm, updateForm, deleteForm } from "@/services/applicationFormService";
import type { Question, QuestionType } from "@/services/applicationFormService";
import { hasGuildAccess } from "@/lib/apiAuth";

type Ctx = { params: Promise<{ guildId: string; formId: string }> };
const VALID_TYPES: QuestionType[] = ["open_text", "single_choice", "multiple_choice"];

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateQuestion(q: unknown, index: number): string | null {
  if (!q || typeof q !== "object") return `Question ${index}: doit être un objet`;
  const obj = q as Record<string, unknown>;
  if (typeof obj["id"] !== "string" || !obj["id"].trim()) return `Question ${index}: id manquant`;
  if (typeof obj["label"] !== "string" || !obj["label"].trim()) return `Question ${index}: label manquant`;
  if (!VALID_TYPES.includes(obj["type"] as QuestionType)) return `Question ${index}: type invalide`;
  if (typeof obj["required"] !== "boolean") return `Question ${index}: required doit être un booléen`;

  const isOpenText = obj["type"] === "open_text";
  const options = obj["options"];
  if (!isOpenText) {
    if (!isStringArray(options) || options.length === 0)
      return `Question ${index}: options requises pour ce type`;
    if (options.length > 25) return `Question ${index}: maximum 25 options`;
    if (options.some((option) => !option.trim())) return `Question ${index}: options invalides`;
  }

  return null;
}

export async function GET(request: Request, context: Ctx) {
  try {
    const { guildId, formId } = await context.params;
    if (!await hasGuildAccess(request, guildId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const form = await getForm(guildId, formId);
    if (!form) return NextResponse.json({ error: "Formulaire introuvable" }, { status: 404 });
    return NextResponse.json(form);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const { guildId, formId } = await context.params;
    if (!await hasGuildAccess(request, guildId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const {
      name, description, questions, acceptRoleIDs, removeRoleIDs, rejectRoleIDs,
      welcomeChannelID, welcomeMessageID, submissionChannelID,
      cooldownMs, sessionTimeoutMs, isActive,
    } = body as Record<string, unknown>;

    const patch: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "name invalide" }, { status: 400 });
      }
      patch["name"] = name.trim();
    }
    if (description !== undefined) {
      if (typeof description !== "string") {
        return NextResponse.json({ error: "description invalide" }, { status: 400 });
      }
      patch["description"] = description;
    }
    if (questions !== undefined) {
      if (!Array.isArray(questions)) {
        return NextResponse.json({ error: "questions invalides" }, { status: 400 });
      }
      if (questions.length > 25) {
        return NextResponse.json({ error: "Maximum 25 questions" }, { status: 400 });
      }
      for (let i = 0; i < questions.length; i++) {
        const error = validateQuestion(questions[i], i + 1);
        if (error) return NextResponse.json({ error }, { status: 400 });
      }
      patch["questions"] = questions as Question[];
    }
    if (acceptRoleIDs !== undefined) {
      if (!isStringArray(acceptRoleIDs)) return NextResponse.json({ error: "acceptRoleIDs invalides" }, { status: 400 });
      patch["acceptRoleIDs"] = acceptRoleIDs;
    }
    if (removeRoleIDs !== undefined) {
      if (!isStringArray(removeRoleIDs)) return NextResponse.json({ error: "removeRoleIDs invalides" }, { status: 400 });
      patch["removeRoleIDs"] = removeRoleIDs;
    }
    if (rejectRoleIDs !== undefined) {
      if (!isStringArray(rejectRoleIDs)) return NextResponse.json({ error: "rejectRoleIDs invalides" }, { status: 400 });
      patch["rejectRoleIDs"] = rejectRoleIDs;
    }
    if (welcomeChannelID !== undefined) {
      if (welcomeChannelID !== null && typeof welcomeChannelID !== "string") {
        return NextResponse.json({ error: "welcomeChannelID invalide" }, { status: 400 });
      }
      patch["welcomeChannelID"] = welcomeChannelID;
    }
    if (welcomeMessageID !== undefined) {
      if (welcomeMessageID !== null && typeof welcomeMessageID !== "string") {
        return NextResponse.json({ error: "welcomeMessageID invalide" }, { status: 400 });
      }
      patch["welcomeMessageID"] = welcomeMessageID;
    }
    if (submissionChannelID !== undefined) {
      if (submissionChannelID !== null && typeof submissionChannelID !== "string") {
        return NextResponse.json({ error: "submissionChannelID invalide" }, { status: 400 });
      }
      patch["submissionChannelID"] = submissionChannelID;
    }
    if (cooldownMs !== undefined) {
      if (typeof cooldownMs !== "number" || !Number.isFinite(cooldownMs) || cooldownMs < 0) {
        return NextResponse.json({ error: "cooldownMs invalide" }, { status: 400 });
      }
      patch["cooldownMs"] = cooldownMs;
    }
    if (sessionTimeoutMs !== undefined) {
      if (typeof sessionTimeoutMs !== "number" || !Number.isFinite(sessionTimeoutMs) || sessionTimeoutMs <= 0) {
        return NextResponse.json({ error: "sessionTimeoutMs invalide" }, { status: 400 });
      }
      patch["sessionTimeoutMs"] = sessionTimeoutMs;
    }
    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") return NextResponse.json({ error: "isActive invalide" }, { status: 400 });
      patch["isActive"] = isActive;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
    }

    const updated = await updateForm(guildId, formId, patch as Parameters<typeof updateForm>[2]);
    if (!updated) return NextResponse.json({ error: "Formulaire introuvable" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const { guildId, formId } = await context.params;
    if (!await hasGuildAccess(request, guildId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const deleted = await deleteForm(guildId, formId);
    if (!deleted) return NextResponse.json({ error: "Formulaire introuvable" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
