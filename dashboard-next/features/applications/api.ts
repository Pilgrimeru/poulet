"use client";

import type { ApplicationFormItem, ApplicationSubmissionItem, DiscordChannel, DiscordRole, Question, SubmissionStatus } from "./types";

type DiscordRoleApiItem = {
  roleID: string;
  roleName: string;
  color: number;
  position: number;
};

type DiscordChannelApiItem = {
  channelID: string;
  channelName: string;
  channelType: number | null;
  parentName?: string | null;
};

function buildQuery(params: Record<string, string | number | boolean | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) sp.set(k, String(v));
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export async function fetchForms(guildID: string): Promise<ApplicationFormItem[]> {
  const res = await fetch(`/api/guilds/${guildID}/applications`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch forms");
  return res.json() as Promise<ApplicationFormItem[]>;
}

export async function createForm(
  guildID: string,
  input: Partial<ApplicationFormItem> & { name: string },
): Promise<ApplicationFormItem> {
  const res = await fetch(`/api/guilds/${guildID}/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Failed to create form");
  }
  return res.json() as Promise<ApplicationFormItem>;
}

export async function updateForm(
  guildID: string,
  formID: string,
  patch: Partial<ApplicationFormItem>,
): Promise<ApplicationFormItem> {
  const res = await fetch(`/api/guilds/${guildID}/applications/${formID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Failed to update form");
  }
  return res.json() as Promise<ApplicationFormItem>;
}

export async function deleteForm(guildID: string, formID: string): Promise<void> {
  const res = await fetch(`/api/guilds/${guildID}/applications/${formID}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete form");
}

export async function fetchSubmissions(
  guildID: string,
  formID: string,
  options?: { status?: SubmissionStatus; limit?: number; offset?: number },
): Promise<{ items: ApplicationSubmissionItem[]; total: number; hasMore: boolean }> {
  const query = buildQuery(options ?? {});
  const res = await fetch(`/api/guilds/${guildID}/applications/${formID}/submissions${query}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch submissions");
  return res.json() as Promise<{ items: ApplicationSubmissionItem[]; total: number; hasMore: boolean }>;
}

export async function reviewSubmission(
  guildID: string,
  formID: string,
  submissionID: string,
  patch: { status: "accepted" | "rejected"; reviewerNotes?: string },
): Promise<ApplicationSubmissionItem> {
  const res = await fetch(
    `/api/guilds/${guildID}/applications/${formID}/submissions/${submissionID}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) throw new Error("Failed to review submission");
  return res.json() as Promise<ApplicationSubmissionItem>;
}

export async function fetchDiscordRoles(guildID: string): Promise<DiscordRole[]> {
  const res = await fetch(`/api/guilds/${guildID}/discord-roles`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json() as DiscordRoleApiItem[];
  return data.map((role) => ({
    id: role.roleID,
    name: role.roleName,
    color: role.color,
    position: role.position,
  }));
}

export async function fetchDiscordChannels(guildID: string): Promise<DiscordChannel[]> {
  const res = await fetch(`/api/guilds/${guildID}/discord-channels`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json() as DiscordChannelApiItem[];
  return data.map((channel) => ({
    id: channel.channelID,
    name: channel.channelName,
    type: channel.channelType ?? -1,
    parentName: channel.parentName ?? null,
  }));
}

export { type Question };
