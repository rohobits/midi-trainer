import type { AttemptRecord } from '../scoring/attempt';
import { dayKey, addDays, daysBetween } from './random';

/** Expanding schedule (days) after each consecutive pass; a fail resets to the first step. */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60] as const;

export interface ReviewState {
  drillId: string;
  /** Consecutive passes at the end of the history. */
  streak: number;
  lastDay: string;
  due: string;
  overdueDays: number;
}

/** Spaced review for drills that have been passed at least once. */
export function reviewStates(attempts: readonly AttemptRecord[], today = dayKey()): ReviewState[] {
  const byDrill = new Map<string, AttemptRecord[]>();
  for (const a of attempts) if (a.score != null) byDrill.set(a.drillId, [...(byDrill.get(a.drillId) ?? []), a]);
  const out: ReviewState[] = [];
  for (const [drillId, list] of byDrill) {
    list.sort((a, b) => a.startedAt - b.startedAt);
    let streak = 0;
    for (let i = list.length - 1; i >= 0 && list[i]!.passed; i--) streak++;
    if (streak === 0 && !list.some((a) => a.passed)) continue;
    const last = list[list.length - 1]!;
    const lastDay = dayKey(new Date(last.startedAt));
    const interval = REVIEW_INTERVALS[Math.min(Math.max(streak - 1, 0), REVIEW_INTERVALS.length - 1)]!;
    const due = addDays(lastDay, interval);
    out.push({ drillId, streak, lastDay, due, overdueDays: daysBetween(due, today) });
  }
  return out.sort((a, b) => b.overdueDays - a.overdueDays);
}

/** Drills due today or earlier, most overdue first. */
export function dueToday(attempts: readonly AttemptRecord[], today = dayKey()): ReviewState[] {
  return reviewStates(attempts, today).filter((r) => r.overdueDays >= 0);
}
