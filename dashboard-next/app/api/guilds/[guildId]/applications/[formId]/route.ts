import { NextResponse } from "next/server";
import { getForm, updateForm, deleteForm } from "@/services/applicationFormService";
import type { Question } from "@/services/applicationFormService";

type Ctx = { params: Promise<{ guildId: string; formId: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { guildId, formId } = await context.params;
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
    const body = await request.json();
    const {
      name, description, questions, acceptRoleIDs, removeRoleIDs, rejectRoleIDs,
      welcomeChannelID, welcomeMessageID, submissionChannelID,
      cooldownMs, sessionTimeoutMs, isActive,
    } = body as Record<string, unknown>;

    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch["name"] = String(name).trim();
    if (description !== undefined) patch["description"] = description;
    if (questions !== undefined) patch["questions"] = questions as Question[];
    if (acceptRoleIDs !== undefined) patch["acceptRoleIDs"] = acceptRoleIDs;
    if (removeRoleIDs !== undefined) patch["removeRoleIDs"] = removeRoleIDs;
    if (rejectRoleIDs !== undefined) patch["rejectRoleIDs"] = rejectRoleIDs;
    if (welcomeChannelID !== undefined) patch["welcomeChannelID"] = welcomeChannelID;
    if (welcomeMessageID !== undefined) patch["welcomeMessageID"] = welcomeMessageID;
    if (submissionChannelID !== undefined) patch["submissionChannelID"] = submissionChannelID;
    if (cooldownMs !== undefined) patch["cooldownMs"] = cooldownMs;
    if (sessionTimeoutMs !== undefined) patch["sessionTimeoutMs"] = sessionTimeoutMs;
    if (isActive !== undefined) patch["isActive"] = isActive;

    const updated = await updateForm(guildId, formId, patch as Parameters<typeof updateForm>[2]);
    if (!updated) return NextResponse.json({ error: "Formulaire introuvable" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const { guildId, formId } = await context.params;
    const deleted = await deleteForm(guildId, formId);
    if (!deleted) return NextResponse.json({ error: "Formulaire introuvable" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
