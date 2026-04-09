import "../models";
import { Appeal } from "../models/Appeal";
import { Sanction } from "../models/Sanction";

export type { AppealStatus } from "../models/Appeal";
import type { AppealStatus } from "../models/Appeal";

export interface AppealDTO {
  id: string;
  sanctionID: string;
  text: string;
  status: AppealStatus;
  reviewOutcome: "upheld" | "overturned" | "modified" | "sanctioned_bad_faith" | null;
  resolutionReason: string | null;
  revisedSanction: unknown;
  reviewedAt: number | null;
  createdAt: number;
}

export interface UpdateAppealInput {
  status?: AppealStatus;
  reviewOutcome?: "upheld" | "overturned" | "modified" | "sanctioned_bad_faith" | null;
  resolutionReason?: string | null;
  revisedSanction?: unknown;
  reviewedAt?: number | null;
}

function toDTO(row: Appeal): AppealDTO {
  let revisedSanction: unknown = null;
  if (row.revisedSanction) {
    try {
      revisedSanction = JSON.parse(row.revisedSanction);
    } catch {
      revisedSanction = null;
    }
  }

  return {
    id: row.id,
    sanctionID: row.sanctionID,
    text: row.text,
    status: row.status,
    reviewOutcome: row.reviewOutcome ?? null,
    resolutionReason: row.resolutionReason ?? null,
    revisedSanction,
    reviewedAt: row.reviewedAt === null ? null : Number(row.reviewedAt),
    createdAt: Number(row.createdAt),
  };
}

export async function createAppeal(sanctionID: string, text: string): Promise<AppealDTO> {
  const row = await Appeal.create({
    sanctionID,
    text,
    status: "pending_review",
    createdAt: Date.now(),
  } as any);
  return toDTO(row);
}

export async function listAppeals(
  guildID: string,
  options?: { sanctionID?: string; status?: AppealStatus; limit?: number; offset?: number },
): Promise<{ items: AppealDTO[]; total: number; hasMore: boolean }> {
  const sanctionWhere: Record<string, unknown> = { guildID };
  if (options?.sanctionID) sanctionWhere["id"] = options.sanctionID;

  const appealWhere: Record<string, unknown> = {};
  if (options?.status) appealWhere["status"] = options.status;
  const limit = Math.max(1, Math.min(options?.limit ?? 50, 200));
  const offset = Math.max(0, options?.offset ?? 0);

  const { rows, count } = await Appeal.findAndCountAll({
    where: appealWhere,
    include: [
      {
        model: Sanction,
        where: sanctionWhere,
        attributes: [],
      },
    ],
    order: [["createdAt", "DESC"]],
    limit,
    offset,
    distinct: true,
  });
  return {
    items: rows.map(toDTO),
    total: count,
    hasMore: offset + rows.length < count,
  };
}

export async function getAppealForGuild(guildID: string, appealID: string): Promise<AppealDTO | null> {
  const row = await Appeal.findOne({
    where: { id: appealID },
    include: [
      {
        model: Sanction,
        where: { guildID },
        attributes: [],
      },
    ],
  });
  return row ? toDTO(row) : null;
}

export async function getLatestPendingAppealBySanctionForGuild(guildID: string, sanctionID: string): Promise<AppealDTO | null> {
  const row = await Appeal.findOne({
    where: { sanctionID, status: "pending_review" },
    include: [
      {
        model: Sanction,
        where: { guildID },
        attributes: [],
      },
    ],
    order: [["createdAt", "DESC"]],
  });
  return row ? toDTO(row) : null;
}

export async function updateAppeal(appealID: string, patch: UpdateAppealInput): Promise<AppealDTO | null> {
  const row = await Appeal.findOne({ where: { id: appealID } });
  if (!row) return null;
  await row.update({
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.reviewOutcome !== undefined ? { reviewOutcome: patch.reviewOutcome } : {}),
    ...(patch.resolutionReason !== undefined ? { resolutionReason: patch.resolutionReason } : {}),
    ...(patch.revisedSanction !== undefined ? { revisedSanction: patch.revisedSanction === null ? null : JSON.stringify(patch.revisedSanction) } : {}),
    ...(patch.reviewedAt !== undefined ? { reviewedAt: patch.reviewedAt } : {}),
  });
  return toDTO(row);
}
