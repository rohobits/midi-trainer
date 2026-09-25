import type { ScoringThresholds } from '../../drills/schema';
import type { RampState, TargetState } from './state';

/** Expected value of a ramp at `pos`. */
export function rampExpected(s: Pick<RampState, 't' | 't1' | 'v0' | 'v1'>, pos: number): number {
  const k = (pos - s.t) / Math.max(s.t1 - s.t, 1e-6);
  return s.v0 + (s.v1 - s.v0) * k;
}

/** Prototype scoring: 1 at zero mean error, linear to 0 at `rampZero`. */
export function rampScore(err: number, t: ScoringThresholds): number {
  return Math.max(0, 1 - err / t.rampZero);
}

/**
 * One sample per frame: while `t <= pos <= t1`, accumulate |value - expected| for every
 * active ramp. `values` maps control id → current normalised value.
 */
export function sampleRamps(states: TargetState[], pos: number, values: Readonly<Record<string, number>>): void {
  for (const s of states) {
    if (s.kind !== 'ramp' || s.done) continue;
    if (pos >= s.t && pos <= s.t1) {
      const v = values[s.c] ?? 0;
      s.errSum += Math.abs(v - rampExpected(s, pos));
      s.errN++;
    }
  }
}

/**
 * Finish ramps whose end has passed: mean error, hit if below `rampHit`. A ramp that was
 * never sampled (run jumped past it) scores error 1 (prototype behaviour). Returns finished ids.
 */
export function finishRamps(states: TargetState[], pos: number, t: ScoringThresholds): number[] {
  const finished: number[] = [];
  for (const s of states) {
    if (s.kind !== 'ramp' || s.done) continue;
    if (pos > s.t1) {
      s.done = true;
      const e = s.errN ? s.errSum / s.errN : 1;
      s.err = e;
      s.hit = e < t.rampHit;
      s.miss = !s.hit;
      finished.push(s.id);
    }
  }
  return finished;
}
