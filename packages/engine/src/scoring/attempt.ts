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
  subScores: { timing: number | null; tracking: number | null; technique?: number | null };
  /** 'lesson' (no-fail) or 'performance' (multiplier, energy). */
  mode?: 'lesson' | 'performance';
  /** Performance-mode results. */
  perf?: { points: number; maxCombo: number; stars: number };
  /** Tempo scale used (1 = drill BPM). */
  tempoScale?: number;
  /** Piano: accuracy details. */
  notes?: { correct: number; wrong: number; missed: number; mode: 'wait' | 'play'; hand: 'L' | 'R' | 'B' };
  extraPresses: number;
  inputOffsetMs: number;
  strictness: number;
  perTarget: PerTarget[];
  /** Enables replay. */
  inputLog: InputEvent[];
}

export function perTargetOf(states: readonly TargetState[]): PerTarget[] {
  return states.map((s) => {
    let err: number | null = null;
    switch (s.kind) {
      case 'ramp':
      case 'cross':
        err = s.err;
        break;
      case 'tap':
      case 'cut':
      case 'note':
        err = s.errMs;
        break;
      case 'jog':
        err = s.correct == null ? null : 1 - s.correct;
        break;
      case 'select':
        err = s.hit ? 0 : s.miss ? 1 : null;
        break;
    }
    return { id: s.id, hit: s.hit, err };
  });
}
