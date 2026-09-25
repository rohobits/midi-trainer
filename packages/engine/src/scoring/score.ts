import type { ScoringThresholds } from '../drills/schema';
import { tapScore } from './judges/tap';
import { rampScore } from './judges/ramp';
import { cutScore } from './judges/cut';
import { crossScore } from './judges/cross';
import type { TargetState } from './judges/state';
import { emptyTierCounts, type TierCounts } from './tiers';

export interface SubScores {
  /** Mean tap/cut score ×100 over completed, or null. */
  timing: number | null;
  /** 1 - mean ramp/cross error, ×100 (prototype "fader tracking"), or null. */
  tracking: number | null;
  /** Mean jog/select score ×100, or null. */
  technique: number | null;
}

export interface RunStats {
  /** Prototype score: mean of per-target scores over completed targets, 0..100, or null. */
  score: number | null;
  timingMeanMs: number | null;
  timingSdMs: number | null;
  /** Mean signed tap error (bias): positive = late. */
  timingBiasMs: number | null;
  trackingMean: number | null;
  tiers: TierCounts;
  sub: SubScores;
  completed: number;
  total: number;
  /** Sequence steps hit before an earlier step of the same sequence. */
  orderViolations: number;
}

/** Per-target score 0..1 for a settled target, or null if not settled. */
export function targetScore(s: TargetState, t: ScoringThresholds): number | null {
  switch (s.kind) {
    case 'tap':
      return s.hit && s.errMs != null ? tapScore(s.errMs, t) : s.miss ? 0 : null;
    case 'cut':
      return s.hit ? cutScore(s, t) : s.miss ? 0 : null;
    case 'ramp':
      return s.done && s.err != null ? rampScore(s.err, t) : null;
    case 'cross':
      return s.done ? crossScore(s, t) : null;
    case 'jog':
      return s.done && s.correct != null ? s.correct : null;
    case 'select':
      return s.hit ? 1 : s.miss ? 0 : null;
    case 'note':
      return null;
  }
}

/** Steps of a sequence hit out of order: index i hit while an earlier step is still open. */
export function orderViolations(states: readonly TargetState[]): number {
  let n = 0;
  const byGroup = new Map<number, TargetState[]>();
  for (const s of states) {
    if (s.group?.kind !== 'sequence') continue;
    const list = byGroup.get(s.group.id) ?? [];
    list.push(s);
    byGroup.set(s.group.id, list);
  }
  for (const list of byGroup.values()) {
    list.sort((a, b) => a.group!.index - b.group!.index);
    for (let i = 1; i < list.length; i++) {
      const cur = list[i]!;
      const at = 'hitAt' in cur ? cur.hitAt : null;
      if (!cur.hit || at == null) continue;
      for (let j = 0; j < i; j++) {
        const prev = list[j]!;
        const prevAt = 'hitAt' in prev ? prev.hitAt : null;
        if (prev.hit && prevAt != null && prevAt > at) {
          n++;
          break;
        }
      }
    }
  }
  return n;
}

/** Aggregate stats for control-based targets. Note drills use `noteAccuracy`. */
export function computeStats(states: readonly TargetState[], t: ScoringThresholds): RunStats {
  let pts = 0;
  let completed = 0;
  let total = 0;
  const sub = { timing: [0, 0], tracking: [0, 0], technique: [0, 0] };
  let rampErr = 0;
  let rampN = 0;
  const errs: number[] = [];
  const tiers = emptyTierCounts();
  const violations = orderViolations(states);
  const violators = new Set<number>();
  if (violations) {
    // Mark the violating targets so their score is halved.
    const byGroup = new Map<number, TargetState[]>();
    for (const s of states) if (s.group?.kind === 'sequence') byGroup.set(s.group.id, [...(byGroup.get(s.group.id) ?? []), s]);
    for (const list of byGroup.values()) {
      list.sort((a, b) => a.group!.index - b.group!.index);
      for (let i = 1; i < list.length; i++) {
        const cur = list[i]!;
        const at = 'hitAt' in cur ? cur.hitAt : null;
        if (!cur.hit || at == null) continue;
        if (list.slice(0, i).some((p) => p.hit && 'hitAt' in p && p.hitAt != null && p.hitAt > at)) violators.add(cur.id);
      }
    }
  }
  for (const s of states) {
    if (s.kind === 'note') continue;
    total++;
    let p = targetScore(s, t);
    if (p == null) continue;
    if (violators.has(s.id)) p *= 0.5;
    completed++;
    pts += p;
    if (s.kind === 'tap' || s.kind === 'cut') {
      sub.timing[0]! += p;
      sub.timing[1]!++;
      if (s.tier) tiers[s.tier]++;
      if (s.hit && s.errMs != null) errs.push(s.errMs);
    } else if (s.kind === 'ramp' || s.kind === 'cross') {
      sub.tracking[0]! += p;
      sub.tracking[1]!++;
      rampErr += s.err ?? 1;
      rampN++;
    } else {
      sub.technique[0]! += p;
      sub.technique[1]!++;
    }
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const timingBiasMs = errs.length ? mean(errs) : null;
  const timingSdMs =
    errs.length > 1 && timingBiasMs != null ? Math.sqrt(mean(errs.map((e) => (e - timingBiasMs) ** 2))) : errs.length === 1 ? 0 : null;
  const pct = ([a, n]: number[]) => (n ? Math.round((100 * a!) / n!) : null);
  return {
    score: completed ? Math.round((100 * pts) / completed) : null,
    timingMeanMs: errs.length ? Math.round(mean(errs.map(Math.abs))) : null,
    timingSdMs: timingSdMs == null ? null : Math.round(timingSdMs),
    timingBiasMs: timingBiasMs == null ? null : Math.round(timingBiasMs),
    trackingMean: rampN ? rampErr / rampN : null,
    tiers,
    sub: { timing: pct(sub.timing), tracking: rampN ? Math.round(100 * (1 - rampErr / rampN)) : null, technique: pct(sub.technique) },
    completed,
    total,
    orderViolations: violations,
  };
}
