"use client";

import styles from "./Moderation.module.css";
import { type FlaggedMessageStatus, type ModerationReportStatus, type SanctionDraft, type SanctionItem } from "./types";

export function formatDate(value: number | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR");
}

export function formatDuration(value: number | null): string {
  if (value === null) return "—";
  const minutes = Math.ceil(value / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.ceil(hours / 24)} j`;
}

export function toDraft(sanction: SanctionItem): SanctionDraft {
  return { type: sanction.type, severity: sanction.severity, nature: sanction.nature, reason: sanction.reason, durationMs: sanction.durationMs };
}

export function getStatusClassName(status: ModerationReportStatus | FlaggedMessageStatus): string {
  if (status === "sanctioned") return styles.statusSanctioned;
  if (status === "dismissed") return styles.statusDismissed;
  if (status === "ready" || status === "awaiting_confirmation") return styles.statusReady;
  if (status === "needs_followup" || status === "awaiting_reporter" || status === "needs_certification") return styles.statusNeedsFollowup;
  return styles.statusNeutral;
}

export function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
