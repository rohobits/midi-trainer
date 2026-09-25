import type { ScoringThresholds } from '../../drills/schema';
import { tierFor } from '../tiers';
import type { TapState, TargetState } from './state';

export function beatsToMs(beats: number, bpm: number): number {
  return (beats * 60000) / bpm;
}

/** Prototype scoring: 1 at zero error, linear to 0 at `tapZeroMs`. */
export function tapScore(errMs: number, t: ScoringThresholds): number {
  return Math.max(0, 1 - Math.abs(errMs) / t.tapZeroMs);
}

export interface TapJudgement {
  /** The target that was hit, or null for an extra (unmatched) press. */
  target: TapState | null;
}

/**
 * Judge a press on control `c` at position `pos` (beats). Candidates are unhit, unmissed
 * taps on the same control within ±tapWindowBeats; the nearest wins. Mutates the state.
 * An unmatched press is an "extra" and is not scored (prototype behaviour).
 */
export function judgeTap(
  states: TargetState[],
  c: string,
  pos: number,
  bpm: number,
  t: ScoringThresholds,
  strictness = 1,
): TapJudgement {
  let best: TapState | null = null;
  let bestDist = Infinity;
  for (const s of states) {
    if (s.kind !== 'tap' || s.c !== c || s.hit || s.miss) continue;
    const dist = Math.abs(s.t - pos);
    if (dist <= t.tapWindowBeats && dist < bestDist) {
      best = s;
      bestDist = dist;
    }
  }
  if (!best) return { target: null };
  best.hit = true;
  best.errMs = beatsToMs(pos - best.t, bpm);
  best.tier = tierFor(best.errMs, t, strictness);
  best.hitAt = pos;
  return { target: best };
}

/** Mark taps whose window has passed without a hit as missed. Returns newly missed ids. */
export function expireTaps(states: TargetState[], pos: number, t: ScoringThresholds): number[] {
  const missed: number[] = [];
  for (const s of states) {
    if (s.kind !== 'tap' || s.hit || s.miss) continue;
    if (pos > s.t + t.tapWindowBeats) {
      s.miss = true;
      s.tier = 'miss';
      missed.push(s.id);
    }
  }
  return missed;
}
