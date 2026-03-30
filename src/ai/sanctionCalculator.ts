import type { SanctionNature, SanctionSeverity, SanctionType } from "@/api/sanctionApiService";

export type { SanctionSeverity, SanctionType, SanctionNature };

export interface SanctionComputation {
  durationMs: number;
  sanctionType: SanctionType;
  severity: SanctionSeverity;
  requiresBanConfirmation: boolean;
}

const SEVERITY_ORDER: SanctionSeverity[] = ["LOW", "MEDIUM", "HIGH", "UNFORGIVABLE"];

const BASE_DURATION_MS: Record<SanctionSeverity, number> = {
  LOW: 5 * 60 * 1000,
  MEDIUM: 15 * 60 * 1000,
  HIGH: 24 * 60 * 60 * 1000,
  UNFORGIVABLE: 7 * 24 * 60 * 60 * 1000,
};

function severityToWarnType(severity: SanctionSeverity): SanctionType {
  if (severity === "LOW") return "WARN_LOW";
  if (severity === "MEDIUM") return "WARN_MEDIUM";
  return "WARN_HIGH";
}

export function escalateSeverity(
  severity: SanctionSeverity,
  similarPriorLevel: 0 | 1 | 2 | 3,
): SanctionSeverity {
  const currentIndex = SEVERITY_ORDER.indexOf(severity);
  const nextIndex = Math.min(SEVERITY_ORDER.length - 1, currentIndex + similarPriorLevel);
  return SEVERITY_ORDER[nextIndex];
}

/**
 * Compute a sanction given severity, multiplier, and prior recidivism level.
 * UNFORGIVABLE always results in MUTE (7 days) + BAN_PENDING (caller must create both).
 * For other severities, if multiplier <= 1 (no prior active sanctions), a warn is issued.
 * Otherwise a mute is applied with multiplied duration.
 */
export function computeSanction(
  severity: SanctionSeverity,
  multiplier: number,
  similarPriorLevel: 0 | 1 | 2 | 3,
): SanctionComputation {
  const effectiveSeverity = escalateSeverity(severity, similarPriorLevel);
  const requiresBanConfirmation = effectiveSeverity === "UNFORGIVABLE";
  const baseDurationMs = BASE_DURATION_MS[effectiveSeverity];
  const durationMs = Math.ceil((baseDurationMs * multiplier) / 60_000) * 60_000;

  if (requiresBanConfirmation) {
    return {
      durationMs,
      sanctionType: "MUTE",
      severity: effectiveSeverity,
      requiresBanConfirmation: true,
    };
  }

  const isWarn = multiplier <= 1;
  return {
    durationMs: isWarn ? 0 : durationMs,
    sanctionType: isWarn ? severityToWarnType(effectiveSeverity) : "MUTE",
    severity: effectiveSeverity,
    requiresBanConfirmation: false,
  };
}
