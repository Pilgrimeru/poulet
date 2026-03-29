export type SanctionSeverity = "LOW" | "MEDIUM" | "HIGH" | "UNFORGIVABLE";
export type WarnSeverity = "LOW" | "MEDIUM" | "HIGH";
export type SanctionType = "MUTE" | "BAN_PENDING";

export interface SanctionComputation {
  durationMs: number;
  warnSeverity: WarnSeverity;
  sanctionType: SanctionType;
  requiresBanConfirmation: boolean;
}

const SEVERITY_ORDER: SanctionSeverity[] = ["LOW", "MEDIUM", "HIGH", "UNFORGIVABLE"];

const BASE_DURATION_MS: Record<SanctionSeverity, number> = {
  LOW: 5 * 60 * 1000,
  MEDIUM: 15 * 60 * 1000,
  HIGH: 24 * 60 * 60 * 1000,
  UNFORGIVABLE: 7 * 24 * 60 * 60 * 1000,
};

const WARN_SEVERITY: Record<SanctionSeverity, WarnSeverity> = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  UNFORGIVABLE: "HIGH",
};

export function computeSanction(
  severity: SanctionSeverity,
  multiplier: number,
  similarPriorLevel: 0 | 1 | 2 | 3,
): SanctionComputation {
  const effectiveSeverity = escalateSeverity(severity, similarPriorLevel);
  const baseDurationMs = BASE_DURATION_MS[effectiveSeverity];
  const durationMs = Math.ceil(baseDurationMs * (1 + Math.max(0, multiplier)) / 60_000) * 60_000;
  const requiresBanConfirmation = effectiveSeverity === "UNFORGIVABLE";

  return {
    durationMs,
    warnSeverity: WARN_SEVERITY[effectiveSeverity],
    sanctionType: requiresBanConfirmation ? "BAN_PENDING" : "MUTE",
    requiresBanConfirmation,
  };
}

export function escalateSeverity(
  severity: SanctionSeverity,
  similarPriorLevel: 0 | 1 | 2 | 3,
): SanctionSeverity {
  const currentIndex = SEVERITY_ORDER.indexOf(severity);
  const nextIndex = Math.min(SEVERITY_ORDER.length - 1, currentIndex + similarPriorLevel);
  return SEVERITY_ORDER[nextIndex];
}
