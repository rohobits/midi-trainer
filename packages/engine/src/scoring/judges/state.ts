import type { Drill, Target } from '../../drills/schema';
import type { Tier } from '../tiers';

/** Live state for one target during a run. Mutated by the judges (hot path, 60 fps). */
export interface TapState {
  kind: 'tap';
  id: number;
  c: string;
  t: number;
  hit: boolean;
  miss: boolean;
  /** Signed error in ms (positive = late). Null until hit. */
  errMs: number | null;
  tier: Tier | null;
}

export interface RampState {
  kind: 'ramp';
  id: number;
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
  hit: boolean;
  miss: boolean;
  /** Mean absolute tracking error, 0..1. Null until done. */
  err: number | null;
}

export interface NoteState {
  kind: 'note';
  id: number;
  n: number;
  t: number;
  d: number;
  hand: 'L' | 'R' | undefined;
  hit: boolean;
  miss: boolean;
  /** Signed error in ms for play-along hits. Null in wait mode or until hit. */
  errMs: number | null;
  /** Guide tone already fired for this pass. */
  guided: boolean;
}

export type TargetState = TapState | RampState | NoteState;

export function stateFor(target: Target, id: number): TargetState {
  switch (target.type) {
    case 'tap':
      return { kind: 'tap', id, c: target.c, t: target.t, hit: false, miss: false, errMs: null, tier: null };
    case 'ramp':
      return {
        kind: 'ramp', id, c: target.c, t: target.t, t1: target.t1, v0: target.v0, v1: target.v1,
        source: 'ramp', errSum: 0, errN: 0, done: false, hit: false, miss: false, err: null,
      };
    case 'hold':
      return {
        kind: 'ramp', id, c: target.c, t: target.t, t1: target.t1, v0: target.v, v1: target.v,
        source: 'hold', errSum: 0, errN: 0, done: false, hit: false, miss: false, err: null,
      };
    case 'note':
      return {
        kind: 'note', id, n: target.n, t: target.t, d: target.d, hand: target.hand,
        hit: false, miss: false, errMs: null, guided: false,
      };
  }
}

/** Fresh states for a drill, ids = index in `targets`. */
export function statesFor(drill: Pick<Drill, 'targets'>): TargetState[] {
  return drill.targets.map((t, i) => stateFor(t, i));
}

export function resetState(s: TargetState): void {
  s.hit = false;
  s.miss = false;
  if (s.kind === 'tap') {
    s.errMs = null;
    s.tier = null;
  } else if (s.kind === 'ramp') {
    s.errSum = 0;
    s.errN = 0;
    s.done = false;
    s.err = null;
  } else {
    s.errMs = null;
    s.guided = false;
  }
}
