import { NextResponse } from "next/server";
import { getSanction, revokeSanction, updateSanction } from "@/services/sanctionService";
import { getLatestPendingAppealBySanctionForGuild, updateAppeal } from "@/services/appealService";
import { setMemberTimeout } from "@/services/discordMetaService";

function appliesTimeout(type: string): boolean {
  return type === "MUTE" || type === "BAN_PENDING";
}

export async function GET(_request: Request, context: { params: Promise<{ guildId: string; sanctionId: string }> }) {
  try {
    const { guildId, sanctionId } = await context.params;
    const sanction = await getSanction(guildId, sanctionId);
    if (!sanction) return NextResponse.json({ error: "Sanction not found" }, { status: 404 });
    return NextResponse.json(sanction);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ guildId: string; sanctionId: string }> }) {
  try {
    const { guildId, sanctionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const previous = await getSanction(guildId, sanctionId);
    if (!previous) return NextResponse.json({ error: "Sanction not found" }, { status: 404 });

    const sanction = Object.keys(body).length === 0
      ? await revokeSanction(guildId, sanctionId)
      : await updateSanction(guildId, sanctionId, body);
    if (!sanction) return NextResponse.json({ error: "Sanction not found" }, { status: 404 });

    const moderationReason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : "Mise à jour de sanction depuis le dashboard";

    const hadTimeout = previous.state === "created" && appliesTimeout(previous.type);
    const hasTimeout = sanction.state === "created" && appliesTimeout(sanction.type);

    if (!hasTimeout && hadTimeout) {
      await setMemberTimeout(guildId, sanction.userID, null, moderationReason).catch(() => false);
    } else if (hasTimeout) {
      const newDurationMs = sanction.durationMs ?? 0;
      let effectiveDurationMs: number;

      if (hadTimeout) {
        // Mute already running: compute remaining time so it expires at createdAt + newDurationMs
        const elapsed = Date.now() - previous.createdAt;
        effectiveDurationMs = Math.max(0, newDurationMs - elapsed);
      } else {
        // New timeout (e.g. warn → mute): apply full duration from now
        effectiveDurationMs = newDurationMs;
      }

      await setMemberTimeout(guildId, sanction.userID, effectiveDurationMs, moderationReason).catch(() => false);
    }

    if (previous.state !== "canceled" && sanction.state === "canceled") {
      const pendingAppeal = await getLatestPendingAppealBySanctionForGuild(guildId, sanction.id);
      if (pendingAppeal) {
        await updateAppeal(pendingAppeal.id, {
          status: "overturned",
          reviewOutcome: "overturned",
          resolutionReason: moderationReason,
          reviewedAt: Date.now(),
        });
      }
    }

    return NextResponse.json(sanction);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
