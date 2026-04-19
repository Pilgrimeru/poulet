import "../models";
import { Op } from "sequelize";
import { ApplicationForm } from "../models/ApplicationForm";
import { ApplicationSession } from "../models/ApplicationSession";
import type { Question } from "../models/ApplicationForm";

export type { QuestionType, Question } from "../models/ApplicationForm";

export interface ApplicationFormDTO {
  id: string;
  guildID: string;
  name: string;
  description: string;
  questions: Question[];
  acceptRoleIDs: string[];
  removeRoleIDs: string[];
  rejectRoleIDs: string[];
  welcomeChannelID: string | null;
  welcomeMessageID: string | null;
  submissionChannelID: string | null;
  cooldownMs: number;
  sessionTimeoutMs: number;
  isActive: boolean;
  createdAt: number;
}

export interface CreateFormInput {
  name: string;
  description?: string;
  questions?: Question[];
  acceptRoleIDs?: string[];
  removeRoleIDs?: string[];
  rejectRoleIDs?: string[];
  welcomeChannelID?: string | null;
  submissionChannelID?: string | null;
  cooldownMs?: number;
  sessionTimeoutMs?: number;
  isActive?: boolean;
}

export interface UpdateFormInput extends Partial<CreateFormInput> {
  welcomeMessageID?: string | null;
}

function parseJSON<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toDTO(row: ApplicationForm): ApplicationFormDTO {
  return {
    id: row.id,
    guildID: row.guildID,
    name: row.name,
    description: row.description,
    questions: parseJSON<Question[]>(row.questions, []),
    acceptRoleIDs: parseJSON<string[]>(row.acceptRoleIDs, []),
    removeRoleIDs: parseJSON<string[]>(row.removeRoleIDs, []),
    rejectRoleIDs: parseJSON<string[]>(row.rejectRoleIDs, []),
    welcomeChannelID: row.welcomeChannelID,
    welcomeMessageID: row.welcomeMessageID,
    submissionChannelID: row.submissionChannelID,
    cooldownMs: Number(row.cooldownMs),
    sessionTimeoutMs: Number(row.sessionTimeoutMs),
    isActive: row.isActive,
    createdAt: Number(row.createdAt),
  };
}

export async function createForm(guildID: string, input: CreateFormInput): Promise<ApplicationFormDTO> {
  const row = await ApplicationForm.create({
    guildID,
    name: input.name,
    description: input.description ?? "",
    questions: JSON.stringify(input.questions ?? []),
    acceptRoleIDs: JSON.stringify(input.acceptRoleIDs ?? []),
    removeRoleIDs: JSON.stringify(input.removeRoleIDs ?? []),
    rejectRoleIDs: JSON.stringify(input.rejectRoleIDs ?? []),
    welcomeChannelID: input.welcomeChannelID ?? null,
    welcomeMessageID: null,
    submissionChannelID: input.submissionChannelID ?? null,
    cooldownMs: input.cooldownMs ?? 0,
    sessionTimeoutMs: input.sessionTimeoutMs ?? 900_000,
    isActive: input.isActive ?? true,
    createdAt: Date.now(),
  } as never);
  return toDTO(row);
}

export async function listForms(guildID: string, options?: { isActive?: boolean }): Promise<ApplicationFormDTO[]> {
  const where: Record<string, unknown> = { guildID };
  if (options?.isActive !== undefined) where["isActive"] = options.isActive;
  const rows = await ApplicationForm.findAll({ where, order: [["createdAt", "DESC"]] });
  return rows.map(toDTO);
}

export async function getForm(guildID: string, formID: string): Promise<ApplicationFormDTO | null> {
  const row = await ApplicationForm.findOne({ where: { id: formID, guildID } });
  return row ? toDTO(row) : null;
}

export async function updateForm(
  guildID: string,
  formID: string,
  patch: UpdateFormInput,
): Promise<ApplicationFormDTO | null> {
  const row = await ApplicationForm.findOne({ where: { id: formID, guildID } });
  if (!row) return null;

  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update["name"] = patch.name;
  if (patch.description !== undefined) update["description"] = patch.description;
  if (patch.questions !== undefined) update["questions"] = JSON.stringify(patch.questions);
  if (patch.acceptRoleIDs !== undefined) update["acceptRoleIDs"] = JSON.stringify(patch.acceptRoleIDs);
  if (patch.removeRoleIDs !== undefined) update["removeRoleIDs"] = JSON.stringify(patch.removeRoleIDs);
  if (patch.rejectRoleIDs !== undefined) update["rejectRoleIDs"] = JSON.stringify(patch.rejectRoleIDs);
  if (patch.submissionChannelID !== undefined) update["submissionChannelID"] = patch.submissionChannelID;
  if (patch.cooldownMs !== undefined) update["cooldownMs"] = patch.cooldownMs;
  if (patch.sessionTimeoutMs !== undefined) update["sessionTimeoutMs"] = patch.sessionTimeoutMs;
  if (patch.isActive !== undefined) update["isActive"] = patch.isActive;

  if (patch.welcomeMessageID !== undefined) {
    update["welcomeMessageID"] = patch.welcomeMessageID;
  }

  // When welcome channel changes, reset message ID so the bot re-posts
  if (patch.welcomeChannelID !== undefined) {
    update["welcomeChannelID"] = patch.welcomeChannelID;
    if (patch.welcomeChannelID !== row.welcomeChannelID) {
      update["welcomeMessageID"] = null;
    }
  }

  await row.update(update);
  return toDTO(row);
}

export async function deleteForm(guildID: string, formID: string): Promise<boolean> {
  const row = await ApplicationForm.findOne({ where: { id: formID, guildID } });
  if (!row) return false;
  await ApplicationSession.destroy({ where: { formID } });
  await row.destroy();
  return true;
}

export async function listFormsNeedingWelcomePost(guildID: string): Promise<ApplicationFormDTO[]> {
  const rows = await ApplicationForm.findAll({
    where: {
      guildID,
      isActive: true,
      welcomeChannelID: { [Op.ne]: null },
      welcomeMessageID: null,
    },
  });
  return rows.map(toDTO);
}

export async function setWelcomeMessageID(formID: string, messageID: string): Promise<void> {
  await ApplicationForm.update({ welcomeMessageID: messageID }, { where: { id: formID } });
}
