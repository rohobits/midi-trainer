import type { SelectState, TargetState } from './state';

/**
 * A press on `control` at `pos`. If a select target is open and the control is one of its
 * choices, the target settles: hit for the right one, miss for a wrong one. Returns the
 * target consumed, or null so the press falls through to the tap judge.
 */
export function judgeSelectPress(states: TargetState[], control: string, pos: number): SelectState | null {
  for (const s of states) {
    if (s.kind !== 'select' || s.hit || s.miss) continue;
    if (pos < s.t || pos > s.t1) continue;
    if (!s.choices.includes(control)) continue;
    s.chosen = control;
    s.hitAt = pos;
    if (control === s.c) s.hit = true;
    else s.miss = true;
    return s;
  }
  return null;
}

export function expireSelects(states: TargetState[], pos: number): number[] {
  const missed: number[] = [];
  for (const s of states) {
    if (s.kind !== 'select' || s.hit || s.miss) continue;
    if (pos > s.t1) {
      s.miss = true;
      missed.push(s.id);
    }
  }
  return missed;
}
