import type { ScoringThresholds } from '../../drills/schema';
import { rampExpected, rampScore } from './ramp';
import type { CrossState, TargetState } from './state';

export function crossScore(s: Pick<CrossState, 'err' | 'violationFrac'>, t: ScoringThresholds): number {
  if (s.err == null) return 0;
  return rampScore(s.err, t) * (1 - (s.violationFrac ?? 0));
}

/** Sample both controls while active; count samples where both exceed the ceiling. */
export function sampleCrosses(states: TargetState[], pos: number, values: Readonly<Record<string, number>>): void {
  for (const s of states) {
    if (s.kind !== 'cross' || s.done) continue;
    if (pos < s.t || pos > s.t1) continue;
    const a = values[s.c] ?? 0;
    const b = values[s.c2] ?? 0;
    const ea = Math.abs(a - rampExpected({ t: s.t, t1: s.t1, v0: s.va0, v1: s.va1 }, pos));
    const eb = Math.abs(b - rampExpected({ t: s.t, t1: s.t1, v0: s.vb0, v1: s.vb1 }, pos));
    s.errSum += (ea + eb) / 2;
    s.errN++;
    if (a > s.ceiling && b > s.ceiling) s.violations++;
  }
}

/** Finish crosses past their end: hit if tracking is good and violations are rare. */
export function finishCrosses(states: TargetState[], pos: number, t: ScoringThresholds): number[] {
  const finished: number[] = [];
  for (const s of states) {
    if (s.kind !== 'cross' || s.done) continue;
    if (pos > s.t1) {
      s.done = true;
      s.err = s.errN ? s.errSum / s.errN : 1;
      s.violationFrac = s.errN ? s.violations / s.errN : 0;
      s.hit = s.err < t.rampHit && s.violationFrac < 0.1;
      s.miss = !s.hit;
      finished.push(s.id);
    }
  }
  return finished;
}
