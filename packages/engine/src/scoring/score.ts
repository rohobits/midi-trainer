import type { ScoringThresholds } from '../drills/schema';
import { tapScore } from './judges/tap';
import { rampScore } from './judges/ramp';
import type { TargetState } from './judges/state';
import { emptyTierCounts, type TierCounts } from './tiers';

export interface SubScores {
  /** Mean tap score ×100 over completed taps, or null. */
  timing: number | null;
  /** 1 - mean ramp error, ×100, over completed ramps, or null (prototype "fader tracking"). */
  tracking: number | null;
}

export interface RunStats {
  /** Prototype score: mean of per-target scores over completed targets, 0..100, or null. */
  score: number | null;
  /** Mean |errMs| over tap hits, or null. */
  timingMeanMs: number | null;
  /** Standard deviation of signed tap error over hits, or null. */
  timingSdMs: number | null;
  /** Mean signed tap error (bias): positive = late. */
  timingBiasMs: number | null;
  /** Mean ramp error 0..1 over completed ramps, or null. */
  trackingMean: number | null;
  tiers: TierCounts;
  sub: SubScores;
  completed: number;
  total: number;
}

/** Aggregate stats for tap/ramp targets (DJ drills). Note drills use `noteAccuracy`. */
export function computeStats(states: readonly TargetState[], t: ScoringThresholds): RunStats {
  let pts = 0;
  let completed = 0;
  let total = 0;
  let tapPts = 0;
  let tapN = 0;
  let rampErr = 0;
  let rampN = 0;
  const errs: number[] = [];
  const tiers = emptyTierCounts();
  for (const s of states) {
    if (s.kind === 'note') continue;
    total++;
    if (s.kind === 'tap') {
      if (!(s.hit || s.miss)) continue;
      completed++;
      tapN++;
      if (s.tier) tiers[s.tier]++;
      if (s.hit && s.errMs != null) {
        const p = tapScore(s.errMs, t);
        pts += p;
        tapPts += p;
        errs.push(s.errMs);
      }
    } else {
      if (!s.done || s.err == null) continue;
      completed++;
      rampN++;
      rampErr += s.err;
      pts += rampScore(s.err, t);
    }
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const timingBiasMs = errs.length ? mean(errs) : null;
  const timingSdMs =
    errs.length > 1 && timingBiasMs != null
      ? Math.sqrt(mean(errs.map((e) => (e - timingBiasMs) ** 2)))
      : errs.length === 1
        ? 0
        : null;
  return {
    score: completed ? Math.round((100 * pts) / completed) : null,
    timingMeanMs: errs.length ? Math.round(mean(errs.map(Math.abs))) : null,
    timingSdMs: timingSdMs == null ? null : Math.round(timingSdMs),
    timingBiasMs: timingBiasMs == null ? null : Math.round(timingBiasMs),
    trackingMean: rampN ? rampErr / rampN : null,
    tiers,
    sub: {
      timing: tapN ? Math.round((100 * tapPts) / tapN) : null,
      tracking: rampN ? Math.round(100 * (1 - rampErr / rampN)) : null,
    },
    completed,
    total,
  };
}
