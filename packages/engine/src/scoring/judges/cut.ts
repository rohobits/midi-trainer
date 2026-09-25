import type { ScoringThresholds } from '../../drills/schema';
import { tierFor } from '../tiers';
import { beatsToMs, tapScore } from './tap';
import type { CutState, TargetState } from './state';

const ZONE0 = 0.2;
const ZONE1 = 0.15;

/**
 * Score for a landed cut: timing like a tap, scaled down when the traverse took longer than
 * `maxMs` (linear to 0 at 2×maxMs).
 */
export function cutScore(s: Pick<CutState, 'errMs' | 'traverseMs' | 'maxMs'>, t: ScoringThresholds): number {
  if (s.errMs == null) return 0;
  const timing = tapScore(s.errMs, t);
  const tr = s.traverseMs ?? 0;
  const speed = tr <= s.maxMs ? 1 : Math.max(0, 1 - (tr - s.maxMs) / s.maxMs);
  return timing * speed;
}

/**
 * Feed a value change on control `c` at position `pos` and clock time `timeMs`. Tracks when
 * the value leaves the start zone and when it lands in the end zone. Only the cut whose
 * window contains `pos` can land. Returns the cut that landed, if any.
 */
export function judgeCutValue(
  states: TargetState[],
  c: string,
  v: number,
  pos: number,
  timeMs: number,
  bpm: number,
  t: ScoringThresholds,
  strictness = 1,
): CutState | null {
  for (const s of states) {
    if (s.kind !== 'cut' || s.c !== c || s.hit || s.miss) continue;
    const inWindow = Math.abs(pos - s.t) <= t.tapWindowBeats;
    const nearStart = Math.abs(v - s.v0) <= ZONE0;
    const nearEnd = Math.abs(v - s.v1) <= ZONE1;
    // Leaving the start zone arms the traverse timer (any time before the window closes).
    if (s.leftAt == null && !nearStart && pos <= s.t + t.tapWindowBeats && pos >= s.t - 2) s.leftAt = timeMs;
    if (nearStart) s.leftAt = null;
    if (inWindow && nearEnd) {
      s.hit = true;
      s.errMs = beatsToMs(pos - s.t, bpm);
      s.traverseMs = s.leftAt == null ? 0 : Math.max(0, timeMs - s.leftAt);
      s.tier = tierFor(s.errMs, t, strictness);
      s.hitAt = pos;
      return s;
    }
  }
  return null;
}

/** Cuts whose window has closed without landing are missed. */
export function expireCuts(states: TargetState[], pos: number, t: ScoringThresholds): number[] {
  const missed: number[] = [];
  for (const s of states) {
    if (s.kind !== 'cut' || s.hit || s.miss) continue;
    if (pos > s.t + t.tapWindowBeats) {
      s.miss = true;
      s.tier = 'miss';
      missed.push(s.id);
    }
  }
  return missed;
}
