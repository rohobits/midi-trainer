import type { ScoringThresholds } from '../../drills/schema';
import { beatsToMs } from './tap';
import { tierFor } from '../tiers';
import type { NoteState, TargetState } from './state';
import type { Tier } from '../tiers';

export type Hand = 'L' | 'R' | 'B';
export type NoteMode = 'wait' | 'play';

const EPS = 1e-6;

export function noteActive(s: Pick<NoteState, 'hand'>, hand: Hand): boolean {
  return hand === 'B' || s.hand === undefined || s.hand === hand;
}

/** Wait mode: every unhit active note whose start is exactly `pos`. */
export function dueGroup(states: TargetState[], pos: number, hand: Hand): NoteState[] {
  const out: NoteState[] = [];
  for (const s of states) {
    if (s.kind !== 'note' || s.hit || !noteActive(s, hand)) continue;
    if (s.t >= pos - EPS && s.t <= pos + EPS) out.push(s);
  }
  return out;
}

/** Wait mode: the earliest unhit active note at or after `pos`, or null. */
export function nextUnhit(states: TargetState[], pos: number, hand: Hand): NoteState | null {
  let best: NoteState | null = null;
  for (const s of states) {
    if (s.kind !== 'note' || s.hit || !noteActive(s, hand)) continue;
    if (s.t >= pos - EPS && (!best || s.t < best.t)) best = s;
  }
  return best;
}

export interface NoteJudgement {
  target: NoteState | null;
  tier: Tier | null;
}

/**
 * Judge a note-on. Wait mode: a hit if the note is in the due group. Play-along: nearest
 * unhit, unmissed active note of that pitch within ±noteWindowBeats. Anything else is a
 * wrong note. Mutates state.
 */
export function judgeNoteOn(
  states: TargetState[],
  n: number,
  pos: number,
  bpm: number,
  mode: NoteMode,
  hand: Hand,
  t: ScoringThresholds,
  strictness = 1,
): NoteJudgement {
  if (mode === 'wait') {
    const target = dueGroup(states, pos, hand).find((s) => s.n === n) ?? null;
    if (target) target.hit = true;
    return { target, tier: target ? 'perfect' : null };
  }
  let best: NoteState | null = null;
  let bestDist = Infinity;
  for (const s of states) {
    if (s.kind !== 'note' || s.hit || s.miss || s.n !== n || !noteActive(s, hand)) continue;
    const dist = Math.abs(s.t - pos);
    if (dist <= t.noteWindowBeats && dist < bestDist) {
      best = s;
      bestDist = dist;
    }
  }
  if (!best) return { target: null, tier: null };
  best.hit = true;
  best.errMs = beatsToMs(pos - best.t, bpm);
  return { target: best, tier: tierFor(best.errMs, t, strictness) };
}

/** Play-along: notes whose window has passed are missed. Returns newly missed ids. */
export function expireNotes(states: TargetState[], pos: number, hand: Hand, t: ScoringThresholds): number[] {
  const missed: number[] = [];
  for (const s of states) {
    if (s.kind !== 'note' || s.hit || s.miss || !noteActive(s, hand)) continue;
    if (pos > s.t + t.noteWindowBeats) {
      s.miss = true;
      missed.push(s.id);
    }
  }
  return missed;
}

/** Notes that should be lit on the keyboard right now: unhit, active, sounding at `pos`. */
export function expectedNotes(states: TargetState[], pos: number, hand: Hand): NoteState[] {
  const out: NoteState[] = [];
  for (const s of states) {
    if (s.kind !== 'note' || s.hit || !noteActive(s, hand)) continue;
    if (s.t <= pos + EPS && s.t + s.d > pos) out.push(s);
  }
  return out;
}

/** Prototype accuracy: correct / (correct + wrong + missed). Null when nothing happened. */
export function noteAccuracy(correct: number, wrong: number, missed: number): number | null {
  const tot = correct + wrong + missed;
  return tot ? Math.round((100 * correct) / tot) : null;
}
