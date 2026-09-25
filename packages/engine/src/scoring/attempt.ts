import type { Medal } from './medals';
import type { TierCounts } from './tiers';
import type { TargetState } from './judges/state';

export interface InputEvent {
  /** Position in beats when the event arrived. */
  t: number;
  /** Control id (or `note:<n>` for piano). */
  c: string;
  /** Normalised value for CC; 1 for a press. */
  v: number;
}

export interface PerTarget {
  id: number;
  hit: boolean;
  /** ms for taps/notes, 0..1 mean error for ramps, null if never judged. */
  err: number | null;
}

export interface AttemptRecord {
  id?: number;
  drillId: string;
  profile: string;
  startedAt: number;
  endedAt: number;
  bpm: number;
  score: number | null;
  passed: boolean;
  medal: Medal;
  timingMeanMs: number | null;
  timingSdMs: number | null;
  trackingMean: number | null;
  tiers: TierCounts;
  subScores: { timing: number | null; tracking: number | null };
  extraPresses: number;
  inputOffsetMs: number;
  strictness: number;
  perTarget: PerTarget[];
  /** Enables replay. */
  inputLog: InputEvent[];
}

export function perTargetOf(states: readonly TargetState[]): PerTarget[] {
  return states.map((s) => ({
    id: s.id,
    hit: s.hit,
    err: s.kind === 'ramp' ? s.err : s.errMs,
  }));
}
