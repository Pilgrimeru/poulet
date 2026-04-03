"use client";

import type { FlaggedMessageStatus, ModerationReportStatus, SanctionNature, SanctionType, Severity } from "./types";

export const SEVERITY_LEVELS: Severity[] = ["NONE", "LOW", "MEDIUM", "HIGH", "UNFORGIVABLE"];

export const SEVERITY_LABELS: Record<Severity, string> = {
  NONE: "Aucune",
  LOW: "Faible",
  MEDIUM: "Modérée",
  HIGH: "Grave",
  UNFORGIVABLE: "Impardonnable",
};

export const NATURE_LABELS: Record<SanctionNature, string> = {
  Extremism: "Extrémisme",
  Violence: "Violence",
  Hate: "Haine",
  Harassment: "Harcèlement",
  Spam: "Spam",
  Manipulation: "Manipulation",
  Recidivism: "Récidive",
  Other: "Autre",
};

export const TYPE_LABELS: Record<SanctionType, string> = {
  WARN_LOW: "Avertissement faible",
  WARN_MEDIUM: "Avertissement moyen",
  WARN_HIGH: "Avertissement élevé",
  MUTE: "Exclusion",
  BAN_PENDING: "Ban en attente",
};

export const REPORT_STATUS_LABELS: Record<ModerationReportStatus, string> = {
  awaiting_ai: "En attente IA",
  awaiting_reporter: "À compléter",
  awaiting_confirmation: "À confirmer",
  needs_followup: "À compléter",
  ready: "Prêt",
  sanctioned: "Sanctionné",
  dismissed: "Classé",
};

export const FLAG_STATUS_LABELS: Record<FlaggedMessageStatus, string> = {
  pending: "En attente",
  analyzed: "Analysé",
  dismissed: "Classé",
  escalated: "Escaladé",
  needs_certification: "À certifier",
  sanctioned: "Sanctionné",
};
