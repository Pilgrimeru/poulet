"use client";

import type { AppealItem, AppealStatus, FlaggedMessageItem, ModerationReportItem, PaginatedResult, SanctionDraft, SanctionItem, SanctionState } from "./types";

function buildListQuery(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function fetchAppeals(guildID: string, options?: { status?: AppealStatus; limit?: number; offset?: number }): Promise<PaginatedResult<AppealItem>> {
  const query = buildListQuery(options ?? {});
  const response = await fetch(`/api/guilds/${guildID}/appeals${query}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to fetch appeals");
  return await response.json() as PaginatedResult<AppealItem>;
}

export async function fetchSanctions(guildID: string, options?: { state?: SanctionState; userId?: string; limit?: number; offset?: number }): Promise<PaginatedResult<SanctionItem>> {
  const query = buildListQuery(options ?? {});
  const response = await fetch(`/api/guilds/${guildID}/sanctions${query}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to fetch sanctions");
  return await response.json() as PaginatedResult<SanctionItem>;
}

export async function fetchReports(guildID: string, options?: { status?: string; limit?: number; offset?: number }): Promise<PaginatedResult<ModerationReportItem>> {
  const query = buildListQuery(options ?? {});
  const response = await fetch(`/api/guilds/${guildID}/moderation-reports${query}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to fetch reports");
  return await response.json() as PaginatedResult<ModerationReportItem>;
}

export async function fetchFlags(guildID: string, options?: { status?: string; targetUserId?: string; limit?: number; offset?: number }): Promise<PaginatedResult<FlaggedMessageItem>> {
  const query = buildListQuery(options ?? {});
  const response = await fetch(`/api/guilds/${guildID}/flagged-messages${query}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to fetch flags");
  return await response.json() as PaginatedResult<FlaggedMessageItem>;
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
