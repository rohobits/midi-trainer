import type { Drill, ScoringThresholds } from '../drills/schema';

/**
 * Defaults carried over from the prototypes (tap window, decay, ramp hit/zero, note
 * window) plus judgement tiers modelled on osu! OD5 / FNF windows.
 */
export const DEFAULT_THRESHOLDS: ScoringThresholds = {
  tapWindowBeats: 0.35,
  tapZeroMs: 150,
  rampHit: 0.18,
  rampZero: 0.3,
  noteWindowBeats: 0.3,
  tierPerfectMs: 40,
  tierGreatMs: 90,
  tierOkMs: 140,
};

/** Settings override defaults; the drill overrides settings. */
export function resolveThresholds(
  drill?: Pick<Drill, 'thresholds'> | null,
  settings?: Partial<ScoringThresholds> | null,
): ScoringThresholds {
  return { ...DEFAULT_THRESHOLDS, ...(settings ?? {}), ...(drill?.thresholds ?? {}) };
}
