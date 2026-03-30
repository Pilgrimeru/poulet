import { NextResponse } from "next/server";
import { createSanction, getSanction, listSanctions, updateSanction } from "@/services/sanctionService";
import { getAppealForGuild, updateAppeal } from "@/services/appealService";
import { sendDirectMessage, setMemberTimeout } from "@/services/discordMetaService";
import { getSessionFromCookies } from "@/lib/auth";
import type { AppealStatus } from "@/services/appealService";
import type { CreateSanctionInput, UpdateSanctionInput } from "@/services/sanctionService";

export async function PATCH(request: Request, context: { params: Promise<{ guildId: string; appealId: string }> }) {
  try {
    const { guildId, appealId } = await context.params;
    const body = await request.json();
    const resolutionReason = typeof body.resolutionReason === "string" ? body.resolutionReason.trim() : "";
    if (!resolutionReason) {
      return NextResponse.json({ error: "Resolution reason is required" }, { status: 400 });
    }

    const appeal = await getAppealForGuild(guildId, appealId);
    if (!appeal) return NextResponse.json({ error: "Appeal not found" }, { status: 404 });

    const linkedSanction = await getSanction(guildId, appeal.sanctionID);
    if (!linkedSanction) {
      return NextResponse.json({ error: "Linked sanction not found" }, { status: 404 });
    }

    const session = await getSessionFromCookies();
    const moderatorID = session?.user.id ?? linkedSanction.moderatorID;

    const reviewOutcome = body.reviewOutcome as "upheld" | "overturned" | "modified" | "sanctioned_bad_faith" | undefined;
    const revisedSanction = body.revisedSanction as UpdateSanctionInput | undefined;
    const badFaithSanction = body.badFaithSanction as CreateSanctionInput | undefined;

    if (reviewOutcome === "overturned") {
      await updateSanction(guildId, linkedSanction.id, { state: "canceled" });
      if (linkedSanction.type === "MUTE") {
        await setMemberTimeout(guildId, linkedSanction.userID, null, resolutionReason).catch(() => false);
      }
      await sendDirectMessage(
        linkedSanction.userID,
        `Ton appel a ete accepte.\nLa sanction a ete annulee.\nMotif: ${resolutionReason}`,
      ).catch(() => false);
    }

    if (reviewOutcome === "modified") {
      if (!revisedSanction) {
        return NextResponse.json({ error: "Revised sanction is required" }, { status: 400 });
      }
      const updatedSanction = await updateSanction(guildId, linkedSanction.id, revisedSanction);
      if (!updatedSanction) {
        return NextResponse.json({ error: "Sanction not found" }, { status: 404 });
      }

      if (updatedSanction.type === "MUTE") {
        await setMemberTimeout(
          guildId,
          updatedSanction.userID,
          updatedSanction.durationMs ?? 0,
          resolutionReason,
        ).catch(() => false);
      } else {
        await setMemberTimeout(guildId, updatedSanction.userID, null, resolutionReason).catch(() => false);
      }

      if (updatedSanction.severity !== "UNFORGIVABLE") {
        const pending = await listSanctions(guildId, updatedSanction.userID, { state: "created" });
        const pendingBan = pending.find((row) =>
          row.type === "BAN_PENDING" &&
          row.reason === linkedSanction.reason &&
          row.userID === linkedSanction.userID,
        );
        if (pendingBan) {
          await updateSanction(guildId, pendingBan.id, { state: "canceled" });
        }
      }

      await sendDirectMessage(
        updatedSanction.userID,
        `Ton appel a ete traite. La sanction a ete modifiee.\nNouvelle mesure: ${updatedSanction.type}\nMotif: ${resolutionReason}`,
      ).catch(() => false);
    }

    if (reviewOutcome === "upheld") {
      await sendDirectMessage(
        linkedSanction.userID,
        `Ton appel a ete rejete.\nLa sanction est maintenue.\nMotif: ${resolutionReason}`,
      ).catch(() => false);
    }

    if (reviewOutcome === "sanctioned_bad_faith") {
      if (!badFaithSanction) {
        return NextResponse.json({ error: "Bad-faith sanction payload is required" }, { status: 400 });
      }
      const created = await createSanction({
        ...badFaithSanction,
        guildID: guildId,
        userID: linkedSanction.userID,
        moderatorID,
      });
      if (created.type === "MUTE") {
        await setMemberTimeout(guildId, created.userID, created.durationMs ?? 0, resolutionReason).catch(() => false);
      }
      await sendDirectMessage(
        created.userID,
        `Ton appel a ete juge de mauvaise foi et a donne lieu a une nouvelle sanction.\nMesure: ${created.type}\nMotif: ${resolutionReason}`,
      ).catch(() => false);
    }

    const updated = await updateAppeal(appealId, {
      status: (body.status as AppealStatus | undefined) ?? (reviewOutcome === "overturned" ? "overturned" : "upheld"),
      reviewOutcome: reviewOutcome ?? null,
      resolutionReason,
      revisedSanction: revisedSanction ?? null,
      reviewedAt: Date.now(),
    });
    if (!updated) return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
