import { ModerationReport } from "../models/ModerationReport";
import type { ContextMessage } from "./flaggedMessageService";

export type { ContextMessage } from "./flaggedMessageService";

export interface ReportContext {
  messages: ContextMessage[];
  aiSummary?: unknown;
}

export interface ModerationReportDTO {
  id: string;
  guildID: string;
  reporterID: string;
  targetUserID: string;
  ticketChannelID: string;
  status: string;
  reporterSummary: string;
  confirmationCount: number;
  sanctionID: string | null;
  context: ReportContext | null;
  moderatorID: string | null;
  createdAt: number;
}

export interface CreateModerationReportInput {
  guildID: string;
  reporterID: string;
  targetUserID: string;
  ticketChannelID: string;
  status?: string;
  reporterSummary: string;
  confirmationCount?: number;
  sanctionID?: string | null;
  context?: ReportContext | null;
  moderatorID?: string | null;
  createdAt?: number;
}

export interface UpdateModerationReportInput {
  status?: string;
  reporterSummary?: string;
  confirmationCount?: number;
  sanctionID?: string | null;
  context?: ReportContext | null;
  moderatorID?: string | null;
}

function parseContext(value: string | null): ReportContext | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as ReportContext;
  } catch {
    return null;
  }
}

function toDTO(row: ModerationReport): ModerationReportDTO {
  return {
    id: row.id,
    guildID: row.guildID,
    reporterID: row.reporterID,
    targetUserID: row.targetUserID,
    ticketChannelID: row.ticketChannelID,
    status: row.status,
    reporterSummary: row.reporterSummary,
    confirmationCount: row.confirmationCount,
    sanctionID: row.sanctionID ?? null,
    context: parseContext(row.context),
    moderatorID: row.moderatorID ?? null,
    createdAt: Number(row.createdAt),
  };
}

export async function createReport(input: CreateModerationReportInput): Promise<ModerationReportDTO> {
  const row = await ModerationReport.create({
    guildID: input.guildID,
    reporterID: input.reporterID,
    targetUserID: input.targetUserID,
    ticketChannelID: input.ticketChannelID,
    status: input.status ?? "awaiting_ai",
    reporterSummary: input.reporterSummary,
    confirmationCount: input.confirmationCount ?? 0,
    sanctionID: input.sanctionID ?? null,
    context: input.context === undefined ? null : JSON.stringify(input.context),
    moderatorID: input.moderatorID ?? null,
    createdAt: input.createdAt ?? Date.now(),
  } as any);
  return toDTO(row);
}

export async function getReport(guildID: string, reportID: string): Promise<ModerationReportDTO | null> {
  const row = await ModerationReport.findOne({ where: { guildID, id: reportID } });
  return row ? toDTO(row) : null;
}

export async function getReportByChannel(guildID: string, channelID: string): Promise<ModerationReportDTO | null> {
  const row = await ModerationReport.findOne({ where: { guildID, ticketChannelID: channelID } });
  return row ? toDTO(row) : null;
}

export async function updateReport(
  guildID: string,
  reportID: string,
  patch: UpdateModerationReportInput,
): Promise<ModerationReportDTO | null> {
  const row = await ModerationReport.findOne({ where: { guildID, id: reportID } });
  if (!row) return null;
  const updates: Record<string, unknown> = {};
  if (patch.status !== undefined) updates["status"] = patch.status;
  if (patch.reporterSummary !== undefined) updates["reporterSummary"] = patch.reporterSummary;
  if (patch.confirmationCount !== undefined) updates["confirmationCount"] = patch.confirmationCount;
  if (patch.sanctionID !== undefined) updates["sanctionID"] = patch.sanctionID;
  if (patch.context !== undefined) updates["context"] = patch.context === null ? null : JSON.stringify(patch.context);
  if (patch.moderatorID !== undefined) updates["moderatorID"] = patch.moderatorID;
  await row.update(updates);
  return toDTO(row);
}

export async function listReports(
  guildID: string,
  options?: { status?: string },
): Promise<ModerationReportDTO[]> {
  const rows = await ModerationReport.findAll({
    where: {
      guildID,
      ...(options?.status ? { status: options.status } : {}),
    },
    order: [["createdAt", "DESC"]],
  });
  return rows.map(toDTO);
}
