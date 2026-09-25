import type { Drill } from '../../drills/schema';
import { expandDrill, type ControlKindMap, type ExpandedTarget, type GroupInfo } from '../../drills/expand';
import type { Tier } from '../tiers';

/** Live state for one target during a run. Mutated by the judges (hot path, 60 fps). */
interface Base {
  id: number;
  group?: GroupInfo;
  hit: boolean;
  miss: boolean;
}

export interface TapState extends Base {
  kind: 'tap';
  c: string;
  t: number;
  /** Signed error in ms (positive = late). Null until hit. */
  errMs: number | null;
  tier: Tier | null;
  /** Position when hit (sequence order checks). */
  hitAt: number | null;
}

export interface RampState extends Base {
  kind: 'ramp';
  c: string;
  t: number;
  t1: number;
  v0: number;
  v1: number;
  /** Original target type ('ramp' or 'hold'); holds are ramps with v0 === v1. */
  source: 'ramp' | 'hold';
  errSum: number;
  errN: number;
  done: boolean;
  /** Mean absolute tracking error, 0..1. Null until done. */
  err: number | null;
}

export interface NoteState extends Base {
  kind: 'note';
  n: number;
  t: number;
  d: number;
  hand: 'L' | 'R' | undefined;
  errMs: number | null;
  /** Guide tone already fired for this pass. */
  guided: boolean;
}

export interface CutState extends Base {
  kind: 'cut';
  c: string;
  t: number;
  v0: number;
  v1: number;
  maxMs: number;
  /** ms timestamp when the value left the v0 zone; null until then. */
  leftAt: number | null;
  errMs: number | null;
  traverseMs: number | null;
  tier: Tier | null;
  hitAt: number | null;
}

export interface CrossState extends Base {
  kind: 'cross';
  c: string;
  c2: string;
  t: number;
  t1: number;
  va0: number;
  va1: number;
  vb0: number;
  vb1: number;
  ceiling: number;
  errSum: number;
  errN: number;
  violations: number;
  done: boolean;
  err: number | null;
  /** Fraction of samples where both controls exceeded the ceiling. */
  violationFrac: number | null;
}

export interface JogState extends Base {
  kind: 'jog';
  c: string;
  t: number;
  t1: number;
  pattern: ('f' | 'b')[];
  minTicks: number;
  acc: number[];
  done: boolean;
  /** Fraction of segments moved the right way. Null until done. */
  correct: number | null;
}

export interface SelectState extends Base {
  kind: 'select';
  c: string;
  choices: string[];
  t: number;
  t1: number;
  chosen: string | null;
  hitAt: number | null;
}

export type TargetState = TapState | RampState | NoteState | CutState | CrossState | JogState | SelectState;

export function stateFor(target: ExpandedTarget, id: number): TargetState {
  const group = target.group;
  const base = group ? { id, group, hit: false, miss: false } : { id, hit: false, miss: false };
  switch (target.type) {
    case 'tap':
      return { kind: 'tap', ...base, c: target.c, t: target.t, errMs: null, tier: null, hitAt: null };
    case 'ramp':
      return { kind: 'ramp', ...base, c: target.c, t: target.t, t1: target.t1, v0: target.v0, v1: target.v1, source: 'ramp', errSum: 0, errN: 0, done: false, err: null };
    case 'hold':
      return { kind: 'ramp', ...base, c: target.c, t: target.t, t1: target.t1, v0: target.v, v1: target.v, source: 'hold', errSum: 0, errN: 0, done: false, err: null };
    case 'note':
      return { kind: 'note', ...base, n: target.n, t: target.t, d: target.d, hand: target.hand, errMs: null, guided: false };
    case 'cut':
      return { kind: 'cut', ...base, c: target.c, t: target.t, v0: target.v0, v1: target.v1, maxMs: target.maxMs ?? 120, leftAt: null, errMs: null, traverseMs: null, tier: null, hitAt: null };
    case 'cross':
      return { kind: 'cross', ...base, c: target.c, c2: target.c2, t: target.t, t1: target.t1, va0: target.va0, va1: target.va1, vb0: target.vb0, vb1: target.vb1, ceiling: target.ceiling ?? 0.5, errSum: 0, errN: 0, violations: 0, done: false, err: null, violationFrac: null };
    case 'jog':
      return { kind: 'jog', ...base, c: target.c, t: target.t, t1: target.t1, pattern: [...target.pattern], minTicks: target.minTicks ?? 3, acc: target.pattern.map(() => 0), done: false, correct: null };
    case 'select':
      return { kind: 'select', ...base, c: target.c, choices: [...target.choices], t: target.t, t1: target.t1, chosen: null, hitAt: null };
  }
}

/** Fresh states for a drill (compound targets expanded), ids = index in the expanded list. */
export function statesFor(drill: Pick<Drill, 'targets'>, kinds?: ControlKindMap): TargetState[] {
  return expandDrill(drill, kinds).map((t, i) => stateFor(t, i));
}

export function resetState(s: TargetState): void {
  s.hit = false;
  s.miss = false;
  switch (s.kind) {
    case 'tap':
      s.errMs = null;
      s.tier = null;
      s.hitAt = null;
      break;
    case 'ramp':
      s.errSum = 0;
      s.errN = 0;
      s.done = false;
      s.err = null;
      break;
    case 'note':
      s.errMs = null;
      s.guided = false;
      break;
    case 'cut':
      s.leftAt = null;
      s.errMs = null;
      s.traverseMs = null;
      s.tier = null;
      s.hitAt = null;
      break;
    case 'cross':
      s.errSum = 0;
      s.errN = 0;
      s.violations = 0;
      s.done = false;
      s.err = null;
      s.violationFrac = null;
      break;
    case 'jog':
      s.acc = s.pattern.map(() => 0);
      s.done = false;
      s.correct = null;
      break;
    case 'select':
      s.chosen = null;
      s.hitAt = null;
      break;
  }
}

/** Start beat of any state. */
export function stateStart(s: TargetState): number {
  return s.t;
}

/** End beat of any state. */
export function stateEnd(s: TargetState): number {
  switch (s.kind) {
    case 'tap':
    case 'cut':
      return s.t;
    case 'note':
      return s.t + s.d;
    default:
      return s.t1;
  }
}

/** Is this state settled (hit, missed or done)? */
export function stateSettled(s: TargetState): boolean {
  if (s.hit || s.miss) return true;
  return (s.kind === 'ramp' || s.kind === 'cross' || s.kind === 'jog') && s.done;
}
