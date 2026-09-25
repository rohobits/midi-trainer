import type { ScoringThresholds } from '../drills/schema';

export type Tier = 'perfect' | 'great' | 'ok' | 'miss';

export const TIERS: readonly Tier[] = ['perfect', 'great', 'ok', 'miss'];

/**
 * Judgement tier for a timing error. `strictness` scales every window: 1 = default,
 * 0.5 = twice as strict, 2 = twice as loose. A tap can be a scored hit and still tier
 * `miss` when it lands outside the OK window; the continuous score is unaffected.
 */
export function tierFor(errMs: number, t: ScoringThresholds, strictness = 1): Tier {
  const e = Math.abs(errMs);
  if (e <= t.tierPerfectMs * strictness) return 'perfect';
  if (e <= t.tierGreatMs * strictness) return 'great';
  if (e <= t.tierOkMs * strictness) return 'ok';
  return 'miss';
}

export type Timing = 'early' | 'late' | 'on';

/** Early or late, with a small dead band so "on" is reachable. */
export function timingOf(errMs: number, deadBandMs = 10): Timing {
  if (errMs < -deadBandMs) return 'early';
  if (errMs > deadBandMs) return 'late';
  return 'on';
}

export type TierCounts = Record<Tier, number>;

export function emptyTierCounts(): TierCounts {
  return { perfect: 0, great: 0, ok: 0, miss: 0 };
}
