import "../models";
import { Op } from "sequelize";
import { ApplicationSession } from "../models/ApplicationSession";

export interface ApplicationSessionDTO {
  id: string;
  formID: string;
  guildID: string;
  userID: string;
  currentStep: number;
  answers: Record<string, string | string[]>;
  expiresAt: number;
  createdAt: number;
}

function parseJSON<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toDTO(row: ApplicationSession): ApplicationSessionDTO {
  return {
    id: row.id,
    formID: row.formID,
    guildID: row.guildID,
    userID: row.userID,
    currentStep: row.currentStep,
    answers: parseJSON<Record<string, string | string[]>>(row.answers, {}),
    expiresAt: Number(row.expiresAt),
    createdAt: Number(row.createdAt),
  };
}

export async function createSession(
  formID: string,
  guildID: string,
  userID: string,
  sessionTimeoutMs: number,
): Promise<ApplicationSessionDTO> {
  // Delete any existing session for this user+form
  await ApplicationSession.destroy({ where: { formID, userID } });

  const now = Date.now();
  const row = await ApplicationSession.create({
    formID,
    guildID,
    userID,
    currentStep: 0,
    answers: "{}",
    expiresAt: now + sessionTimeoutMs,
    createdAt: now,
  } as never);
  return toDTO(row);
}

export async function getSessionForUser(formID: string, userID: string): Promise<ApplicationSessionDTO | null> {
  const row = await ApplicationSession.findOne({ where: { formID, userID } });
  if (!row) return null;
  // Return null if expired
  if (Number(row.expiresAt) < Date.now()) {
    await row.destroy();
    return null;
  }
  return toDTO(row);
}

export async function getSession(sessionID: string): Promise<ApplicationSessionDTO | null> {
  const row = await ApplicationSession.findOne({ where: { id: sessionID } });
  return row ? toDTO(row) : null;
}

export async function updateSession(
  sessionID: string,
  patch: { currentStep?: number; answers?: Record<string, string | string[]>; expiresAt?: number },
): Promise<ApplicationSessionDTO | null> {
  const row = await ApplicationSession.findOne({ where: { id: sessionID } });
  if (!row) return null;

  const update: Record<string, unknown> = {};
  if (patch.currentStep !== undefined) update["currentStep"] = patch.currentStep;
  if (patch.answers !== undefined) update["answers"] = JSON.stringify(patch.answers);
  if (patch.expiresAt !== undefined) update["expiresAt"] = patch.expiresAt;

  await row.update(update);
  return toDTO(row);
}

export async function deleteSession(sessionID: string): Promise<void> {
  await ApplicationSession.destroy({ where: { id: sessionID } });
}

export async function deleteSessionForUser(formID: string, userID: string): Promise<void> {
  await ApplicationSession.destroy({ where: { formID, userID } });
}

export async function deleteExpiredSessions(): Promise<number> {
  return ApplicationSession.destroy({
    where: { expiresAt: { [Op.lt]: Date.now() } },
  });
}
