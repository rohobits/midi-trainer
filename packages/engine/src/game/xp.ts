import type { AttemptRecord } from '../scoring/attempt';

/** XP for one attempt: accuracy-weighted, with bonuses for medals and a personal best. */
export function xpForAttempt(a: Pick<AttemptRecord, 'score' | 'medal' | 'mode' | 'perf'>, isPb: boolean): number {
  if (a.score == null) return 0;
  let xp = Math.round(a.score / 2);
  if (a.medal === 'bronze') xp += 10;
  if (a.medal === 'silver') xp += 25;
  if (a.medal === 'gold') xp += 50;
  if (isPb) xp += 20;
  if (a.mode === 'performance' && a.perf) xp += a.perf.stars * 5;
  return xp;
}

/** XP needed to reach level n: 100·(n²−1). Level 1 = 0, 2 = 300, 3 = 800, 4 = 1500 … */
export function xpForLevel(n: number): number {
  return 100 * (n * n - 1);
}

export function levelFor(xp: number): { level: number; into: number; next: number } {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const base = xpForLevel(level);
  return { level, into: xp - base, next: xpForLevel(level + 1) - base };
}

export interface Cosmetic {
  id: string;
  kind: 'theme' | 'lanes';
  name: string;
  level: number;
}

/** Cosmetics only; nothing that affects scoring. */
export const COSMETICS: readonly Cosmetic[] = [
  { id: 'default', kind: 'theme', name: 'Studio', level: 1 },
  { id: 'lanes-classic', kind: 'lanes', name: 'Classic lanes', level: 1 },
  { id: 'neon', kind: 'theme', name: 'Neon', level: 3 },
  { id: 'lanes-thin', kind: 'lanes', name: 'Thin lanes', level: 4 },
  { id: 'vinyl', kind: 'theme', name: 'Vinyl', level: 6 },
  { id: 'lanes-bold', kind: 'lanes', name: 'Bold lanes', level: 8 },
  { id: 'festival', kind: 'theme', name: 'Festival', level: 10 },
];

export function totalXp(attempts: readonly AttemptRecord[]): number {
  const best: Record<string, number> = {};
  let xp = 0;
  for (const a of [...attempts].sort((x, y) => x.startedAt - y.startedAt)) {
    const prev = best[a.drillId];
    const isPb = a.score != null && (prev == null || a.score > prev);
    if (isPb && a.score != null) best[a.drillId] = a.score;
    xp += xpForAttempt(a, isPb);
  }
  return xp;
}
