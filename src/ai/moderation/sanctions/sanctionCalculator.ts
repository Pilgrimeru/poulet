import type { SanctionSeverity, SanctionType } from "@/api/sanctionApiService";

export interface SanctionComputation {
  durationMs: number;
  sanctionType: SanctionType;
  severity: SanctionSeverity;
}

const BASE_DURATION_MS: Record<SanctionSeverity, number> = {
  LOW: 5 * 60 * 1000,
  MEDIUM: 15 * 60 * 1000,
  HIGH: 24 * 60 * 60 * 1000,
  UNFORGIVABLE: 7 * 24 * 60 * 60 * 1000,
};

const PENDING_BAN_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function severityToWarnType(severity: SanctionSeverity): SanctionType {
  if (severity === "LOW") return "WARN_LOW";
  if (severity === "MEDIUM") return "WARN_MEDIUM";
  return "WARN_HIGH";
}

/**
 * Compute a sanction from the IA decision.
 * The IA decides WARN vs MUTE vs BAN_PENDING.
 * The duration of a mute is computed algorithmically.
 * BAN_PENDING is a single sanction that implicitly applies a 7-day timeout while waiting for human review.
 */
export function computeSanction(
  severity: SanctionSeverity,
  sanctionKind: "WARN" | "MUTE" | "BAN_PENDING",
  multiplier: number,
): SanctionComputation {
  if (sanctionKind === "BAN_PENDING") {
    return {
      durationMs: PENDING_BAN_DURATION_MS,
      sanctionType: "BAN_PENDING",
      severity,
    };
  }

  const baseDurationMs = BASE_DURATION_MS[severity];
  const durationMs = Math.ceil((baseDurationMs * multiplier) / 60_000) * 60_000;

  return {
    durationMs: sanctionKind === "MUTE" ? durationMs : 0,
    sanctionType: sanctionKind === "MUTE" ? "MUTE" : severityToWarnType(severity),
    severity,
  };
}
