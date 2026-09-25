import type { Drill } from '../drills/schema';

/** Piano Marvel SASR pattern: adaptive ladder, >= passScore steps up, else down; 3 setbacks end. */
export interface PlacementStep {
  drillId: string;
  score: number | null;
  passed: boolean;
}

export interface PlacementState {
  ladder: string[];
  index: number;
  steps: PlacementStep[];
  setbacks: number;
  finished: boolean;
  /** Highest rung passed (0-based), or -1. */
  best: number;
}

export const BENCHMARKS = [
  { min: 0, name: 'First night' },
  { min: 300, name: 'Bedroom' },
  { min: 600, name: 'House party' },
  { min: 900, name: 'Bar resident' },
  { min: 1200, name: 'Club warm-up' },
  { min: 1500, name: 'Peak time' },
  { min: 1800, name: 'Headliner' },
] as const;

/** Drills ordered by tier then level form the ladder; audio- and hardware-gated ones excluded. */
export function buildLadder(drills: readonly Drill[]): string[] {
  const rank: Record<string, number> = { Foundations: 0, Mixing: 1, Performance: 2, Advanced: 3, Pro: 4 };
  return drills
    .filter((d) => d.profile === 'flx4' && !d.needsAudio && !d.requires?.length && d.tier in rank)
    .sort((a, b) => rank[a.tier]! - rank[b.tier]! || (a.level ?? 9) - (b.level ?? 9) || a.name.localeCompare(b.name))
    .map((d) => d.id);
}

export function startPlacement(ladder: string[]): PlacementState {
  return { ladder, index: Math.min(2, Math.max(0, ladder.length - 1)), steps: [], setbacks: 0, finished: ladder.length === 0, best: -1 };
}

export function recordPlacement(state: PlacementState, score: number | null, passScore = 80): PlacementState {
  if (state.finished) return state;
  const passed = score != null && score >= passScore;
  const steps = [...state.steps, { drillId: state.ladder[state.index]!, score, passed }];
  let { index, setbacks, best } = state;
  if (passed) {
    best = Math.max(best, index);
    index = Math.min(state.ladder.length - 1, index + 2);
  } else {
    setbacks++;
    index = Math.max(0, index - 1);
  }
  const finished = setbacks >= 3 || steps.length >= 8 || (passed && state.index === state.ladder.length - 1);
  return { ...state, steps, index, setbacks, best, finished };
}

/** 100–1900 score from the best rung reached, mapped to a named benchmark. */
export function placementResult(state: PlacementState): { score: number; benchmark: string } {
  const n = Math.max(1, state.ladder.length - 1);
  const score = Math.round(100 + (1800 * Math.max(0, state.best)) / n);
  let benchmark: string = BENCHMARKS[0].name;
  for (const b of BENCHMARKS) if (score >= b.min) benchmark = b.name;
  return { score, benchmark };
}
