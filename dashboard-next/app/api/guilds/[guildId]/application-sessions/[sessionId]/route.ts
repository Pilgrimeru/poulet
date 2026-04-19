import { NextResponse } from "next/server";
import { getSession, updateSession, deleteSession } from "@/services/applicationSessionService";
import { hasGuildAccess } from "@/lib/apiAuth";

type Ctx = { params: Promise<{ guildId: string; sessionId: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { guildId, sessionId } = await context.params;
    if (!await hasGuildAccess(_request, guildId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = await getSession(sessionId);
    if (!session) return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
    if (session.guildID !== guildId) {
      return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
    }
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const { guildId, sessionId } = await context.params;
    if (!await hasGuildAccess(request, guildId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const { currentStep, answers, expiresAt } = body as Record<string, unknown>;

    const existing = await getSession(sessionId);
    if (!existing || existing.guildID !== guildId) {
      return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
    }

    const patch: Parameters<typeof updateSession>[1] = {};
    if (typeof currentStep === "number") patch.currentStep = currentStep;
    if (answers && typeof answers === "object" && !Array.isArray(answers))
      patch.answers = answers as Record<string, string | string[]>;
    if (typeof expiresAt === "number") patch.expiresAt = expiresAt;

    const updated = await updateSession(sessionId, patch);
    if (!updated) return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const { guildId, sessionId } = await context.params;
    if (!await hasGuildAccess(_request, guildId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const existing = await getSession(sessionId);
    if (!existing || existing.guildID !== guildId) {
      return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
    }
    await deleteSession(sessionId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
