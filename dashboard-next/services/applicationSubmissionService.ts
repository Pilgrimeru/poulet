import "../models";
import { Op } from "sequelize";
import { ApplicationSubmission } from "../models/ApplicationSubmission";
import { ApplicationForm } from "../models/ApplicationForm";
import type { SubmissionStatus } from "../models/ApplicationSubmission";
import type { ApplicationFormDTO } from "./applicationFormService";

export type { SubmissionStatus } from "../models/ApplicationSubmission";

export interface ApplicationSubmissionDTO {
  id: string;
  formID: string;
  guildID: string;
  userID: string;
  answers: Record<string, string | string[]>;
  status: SubmissionStatus;
  reviewerNotes: string | null;
  reviewedAt: number | null;
  reviewedByUserID: string | null;
  rolesApplied: boolean;
  createdAt: number;
}

export interface CreateSubmissionInput {
  userID: string;
  answers: Record<string, string | string[]>;
}

export interface UpdateSubmissionInput {
  status?: SubmissionStatus;
  reviewerNotes?: string | null;
  reviewedAt?: number | null;
  reviewedByUserID?: string | null;
  rolesApplied?: boolean;
}

export interface PendingRoleItem {
  submission: ApplicationSubmissionDTO;
  form: Pick<ApplicationFormDTO, "id" | "acceptRoleIDs" | "removeRoleIDs" | "rejectRoleIDs" | "cooldownMs" | "name">;
}

function parseJSON<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toDTO(row: ApplicationSubmission): ApplicationSubmissionDTO {
  return {
    id: row.id,
    formID: row.formID,
    guildID: row.guildID,
    userID: row.userID,
    answers: parseJSON<Record<string, string | string[]>>(row.answers, {}),
    status: row.status,
    reviewerNotes: row.reviewerNotes,
    reviewedAt: row.reviewedAt === null ? null : Number(row.reviewedAt),
    reviewedByUserID: row.reviewedByUserID,
    rolesApplied: row.rolesApplied,
    createdAt: Number(row.createdAt),
  };
}

export async function createSubmission(
  formID: string,
  guildID: string,
  input: CreateSubmissionInput,
): Promise<ApplicationSubmissionDTO> {
  const row = await ApplicationSubmission.create({
    formID,
    guildID,
    userID: input.userID,
    answers: JSON.stringify(input.answers),
    status: "pending",
    reviewerNotes: null,
    reviewedAt: null,
    reviewedByUserID: null,
    rolesApplied: false,
    createdAt: Date.now(),
  } as never);
  return toDTO(row);
}

export async function listSubmissions(
  guildID: string,
  formID: string,
  options?: { status?: SubmissionStatus; userID?: string; limit?: number; offset?: number },
): Promise<{ items: ApplicationSubmissionDTO[]; total: number; hasMore: boolean }> {
  const where: Record<string, unknown> = { guildID, formID };
  if (options?.status) where["status"] = options.status;
  if (options?.userID) where["userID"] = options.userID;
  const limit = Math.max(1, Math.min(options?.limit ?? 50, 200));
  const offset = Math.max(0, options?.offset ?? 0);

  const { rows, count } = await ApplicationSubmission.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });
  return {
    items: rows.map(toDTO),
    total: count,
    hasMore: offset + rows.length < count,
  };
}

export async function getSubmission(
  guildID: string,
  submissionID: string,
): Promise<ApplicationSubmissionDTO | null> {
  const row = await ApplicationSubmission.findOne({ where: { id: submissionID, guildID } });
  return row ? toDTO(row) : null;
}

export async function updateSubmission(
  guildID: string,
  submissionID: string,
  patch: UpdateSubmissionInput,
): Promise<ApplicationSubmissionDTO | null> {
  const row = await ApplicationSubmission.findOne({ where: { id: submissionID, guildID } });
  if (!row) return null;

  const update: Record<string, unknown> = {};
  if (patch.status !== undefined) update["status"] = patch.status;
  if (patch.reviewerNotes !== undefined) update["reviewerNotes"] = patch.reviewerNotes;
  if (patch.reviewedAt !== undefined) update["reviewedAt"] = patch.reviewedAt;
  if (patch.reviewedByUserID !== undefined) update["reviewedByUserID"] = patch.reviewedByUserID;
  if (patch.rolesApplied !== undefined) update["rolesApplied"] = patch.rolesApplied;

  await row.update(update);
  return toDTO(row);
}

export async function getActiveSubmissionForUser(
  guildID: string,
  formID: string,
  userID: string,
): Promise<ApplicationSubmissionDTO | null> {
  const row = await ApplicationSubmission.findOne({
    where: { guildID, formID, userID, status: "pending" },
  });
  return row ? toDTO(row) : null;
}

export async function getLatestRejectedSubmissionForUser(
  guildID: string,
  formID: string,
  userID: string,
): Promise<ApplicationSubmissionDTO | null> {
  const row = await ApplicationSubmission.findOne({
    where: { guildID, formID, userID, status: "rejected" },
    order: [["createdAt", "DESC"]],
  });
  return row ? toDTO(row) : null;
}

export async function listPendingRoleProcessing(guildID: string): Promise<PendingRoleItem[]> {
  const submissions = await ApplicationSubmission.findAll({
    where: {
      guildID,
      rolesApplied: false,
      status: { [Op.in]: ["accepted", "rejected"] },
    },
  });

  if (submissions.length === 0) return [];

  const formIDs = [...new Set(submissions.map((s) => s.formID))];
  const forms = await ApplicationForm.findAll({ where: { id: formIDs } });
  const formMap = new Map(
    forms.map((f) => [
      f.id,
      {
        id: f.id,
        name: f.name,
        acceptRoleIDs: JSON.parse(f.acceptRoleIDs || "[]") as string[],
        removeRoleIDs: JSON.parse(f.removeRoleIDs || "[]") as string[],
        rejectRoleIDs: JSON.parse(f.rejectRoleIDs || "[]") as string[],
        cooldownMs: Number(f.cooldownMs),
      },
    ]),
  );

  return submissions
    .map((s) => {
      const form = formMap.get(s.formID);
      if (!form) return null;
      return { submission: toDTO(s), form };
    })
    .filter((item): item is PendingRoleItem => item !== null);
}
