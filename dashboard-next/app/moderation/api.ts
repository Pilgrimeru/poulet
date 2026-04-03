"use client";

import type { AppealItem, AppealStatus, FlaggedMessageItem, ModerationReportItem, SanctionDraft, SanctionItem, SanctionState } from "./types";

export async function fetchAppeals(guildID: string, status?: AppealStatus): Promise<AppealItem[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await fetch(`/api/guilds/${guildID}/appeals${query}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to fetch appeals");
  return ((await response.json()) as AppealItem[]).sort((a, b) => b.createdAt - a.createdAt);
}

export async function fetchSanctions(guildID: string): Promise<SanctionItem[]> {
  const response = await fetch(`/api/guilds/${guildID}/sanctions`, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to fetch sanctions");
  return ((await response.json()) as SanctionItem[]).sort((a, b) => b.createdAt - a.createdAt);
}

export async function fetchReports(guildID: string): Promise<ModerationReportItem[]> {
  const response = await fetch(`/api/guilds/${guildID}/moderation-reports`, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to fetch reports");
  return ((await response.json()) as ModerationReportItem[]).sort((a, b) => b.createdAt - a.createdAt);
}

export async function fetchFlags(guildID: string): Promise<FlaggedMessageItem[]> {
  const response = await fetch(`/api/guilds/${guildID}/flagged-messages`, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to fetch flags");
  return ((await response.json()) as FlaggedMessageItem[]).sort((a, b) => b.createdAt - a.createdAt);
}

export async function patchAppeal(
  guildID: string,
  appealID: string,
  patch: {
    status?: AppealStatus;
    reviewOutcome?: "upheld" | "overturned" | "modified" | "sanctioned_bad_faith";
    resolutionReason: string;
    revisedSanction?: SanctionDraft;
    badFaithSanction?: SanctionDraft;
  },
) {
  const response = await fetch(`/api/guilds/${guildID}/appeals/${appealID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || "Failed to update appeal");
  }
}

export async function patchSanction(guildID: string, sanctionID: string, patch: Partial<SanctionDraft> & { state?: SanctionState }): Promise<SanctionItem> {
  const response = await fetch(`/api/guilds/${guildID}/sanctions/${sanctionID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error("Failed to update sanction");
  return response.json() as Promise<SanctionItem>;
}
