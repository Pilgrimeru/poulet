import { NextResponse } from "next/server";
import {
  createSession,
  getSessionForUser,
  deleteExpiredSessions,
} from "@/services/applicationSessionService";
import { getForm } from "@/services/applicationFormService";
import { hasGuildAccess } from "@/lib/apiAuth";

export async function GET(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    if (!await hasGuildAccess(request, guildId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const formId = searchParams.get("formId");
    const userId = searchParams.get("userId");

    if (!formId || !userId)
      return NextResponse.json({ error: "formId et userId requis" }, { status: 400 });

    const form = await getForm(guildId, formId);
    if (!form) return NextResponse.json({ error: "Formulaire introuvable" }, { status: 404 });

    const session = await getSessionForUser(formId, userId);
    if (!session) return NextResponse.json(null);
    if (session.guildID !== guildId) {
      return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
    }
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    if (!await hasGuildAccess(request, guildId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const { formId, userId } = body as Record<string, unknown>;

    if (typeof formId !== "string" || !formId)
      return NextResponse.json({ error: "formId requis" }, { status: 400 });
    if (typeof userId !== "string" || !userId)
      return NextResponse.json({ error: "userId requis" }, { status: 400 });

    const form = await getForm(guildId, formId);
    if (!form) return NextResponse.json({ error: "Formulaire introuvable" }, { status: 404 });

    const session = await createSession(formId, guildId, userId, form.sessionTimeoutMs);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    if (!await hasGuildAccess(request, guildId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const deleted = await deleteExpiredSessions();
    return NextResponse.json({ deleted });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
