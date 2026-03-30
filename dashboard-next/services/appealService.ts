import { Appeal } from "../models/Appeal";
import { Sanction } from "../models/Sanction";

export type { AppealStatus } from "../models/Appeal";
import type { AppealStatus } from "../models/Appeal";

export interface AppealDTO {
  id: string;
  sanctionID: string;
  text: string;
  status: AppealStatus;
  createdAt: number;
}

export interface UpdateAppealInput {
  status: AppealStatus;
}

function toDTO(row: Appeal): AppealDTO {
  return {
    id: row.id,
    sanctionID: row.sanctionID,
    text: row.text,
    status: row.status,
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
  options?: { sanctionID?: string; status?: AppealStatus },
): Promise<AppealDTO[]> {
  const sanctionWhere: Record<string, unknown> = { guildID };
  if (options?.sanctionID) sanctionWhere["id"] = options.sanctionID;

  const appealWhere: Record<string, unknown> = {};
  if (options?.status) appealWhere["status"] = options.status;

  const rows = await Appeal.findAll({
    where: appealWhere,
    include: [
      {
        model: Sanction,
        where: sanctionWhere,
        attributes: [],
      },
    ],
    order: [["createdAt", "DESC"]],
  });
  return rows.map(toDTO);
}

export async function updateAppeal(appealID: string, patch: UpdateAppealInput): Promise<AppealDTO | null> {
  const row = await Appeal.findOne({ where: { id: appealID } });
  if (!row) return null;
  await row.update({ status: patch.status });
  return toDTO(row);
}
