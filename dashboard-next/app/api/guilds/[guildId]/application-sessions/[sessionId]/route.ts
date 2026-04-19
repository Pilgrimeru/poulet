import { NextResponse } from "next/server";
import { getSession, updateSession, deleteSession } from "@/services/applicationSessionService";

type Ctx = { params: Promise<{ guildId: string; sessionId: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { sessionId } = await context.params;
    const session = await getSession(sessionId);
    if (!session) return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const { sessionId } = await context.params;
    const body = await request.json();
    const { currentStep, answers, expiresAt } = body as Record<string, unknown>;

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
    const { sessionId } = await context.params;
    await deleteSession(sessionId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
