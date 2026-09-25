import type { AttemptRecord } from '../scoring/attempt';
import { dayKey, addDays } from './random';

/** Melodics-style milestones in goal-days. */
export const TROPHY_DAYS = [3, 5, 7, 10, 14, 21, 30, 45, 50, 60, 90, 120, 180, 365] as const;

export interface DayPractice {
  day: string;
  minutes: number;
  attempts: number;
  met: boolean;
}

/** Minutes practised per day from attempt durations (capped per attempt at 30 min against clock glitches). */
export function practiceByDay(attempts: readonly AttemptRecord[], goalMinutes: number): Map<string, DayPractice> {
  const map = new Map<string, DayPractice>();
  for (const a of attempts) {
    const day = dayKey(new Date(a.startedAt));
    const mins = Math.min(30, Math.max(0, (a.endedAt - a.startedAt) / 60000));
    const cur = map.get(day) ?? { day, minutes: 0, attempts: 0, met: false };
    cur.minutes += mins;
    cur.attempts++;
    cur.met = cur.minutes >= goalMinutes;
    map.set(day, cur);
  }
  return map;
}

export interface StreakInfo {
  /** Consecutive goal-days ending today or yesterday. */
  current: number;
  longest: number;
  /** Total goal-days ever. */
  goalDays: number;
  /** Consecutive weeks (Mon–Sun) with at least one goal-day, ending this week or last. */
  weekly: number;
  todayMet: boolean;
  todayMinutes: number;
  nextTrophy: number | null;
  earnedTrophies: number[];
}

function weekKey(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  const dow = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - dow);
  return dayKey(date);
}

export function streakInfo(byDay: Map<string, DayPractice>, today = dayKey()): StreakInfo {
  const met = new Set([...byDay.values()].filter((d) => d.met).map((d) => d.day));
  let current = 0;
  let cursor = met.has(today) ? today : addDays(today, -1);
  while (met.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  let longest = 0;
  const days = [...met].sort();
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  const weeks = new Set(days.map(weekKey));
  let weekly = 0;
  let wk = weeks.has(weekKey(today)) ? weekKey(today) : addDays(weekKey(today), -7);
  while (weeks.has(wk)) {
    weekly++;
    wk = addDays(wk, -7);
  }
  const goalDays = met.size;
  const earnedTrophies = TROPHY_DAYS.filter((t) => goalDays >= t);
  const nextTrophy = TROPHY_DAYS.find((t) => goalDays < t) ?? null;
  const t = byDay.get(today);
  return { current, longest, goalDays, weekly, todayMet: !!t?.met, todayMinutes: t?.minutes ?? 0, nextTrophy, earnedTrophies };
}

/** Last `weeks` weeks of practice as a grid for a calendar heatmap: rows Mon..Sun. */
export function calendar(byDay: Map<string, DayPractice>, weeks = 16, today = dayKey()): { day: string; minutes: number; met: boolean }[][] {
  const start = addDays(weekKey(today), -7 * (weeks - 1));
  const cols: { day: string; minutes: number; met: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: { day: string; minutes: number; met: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(start, w * 7 + d);
      const p = byDay.get(day);
      col.push({ day, minutes: p?.minutes ?? 0, met: !!p?.met });
    }
    cols.push(col);
  }
  return cols;
}
