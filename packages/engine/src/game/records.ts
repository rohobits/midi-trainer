import type { AttemptRecord } from '../scoring/attempt';
import type { Drill } from '../drills/schema';

export interface RecordCard {
  drillId: string;
  name: string;
  tier: string;
  earnedAt: number;
  score: number;
}

/** A gold on a drill unlocks its record; albums are tiers. */
export function records(attempts: readonly AttemptRecord[], drills: readonly Drill[]): Map<string, RecordCard[]> {
  const byDrill = new Map<string, Drill>(drills.map((d) => [d.id, d]));
  const earned = new Map<string, RecordCard>();
  for (const a of attempts) {
    if (a.medal !== 'gold' || a.score == null) continue;
    const d = byDrill.get(a.drillId);
    if (!d) continue;
    const cur = earned.get(a.drillId);
    if (!cur || a.startedAt < cur.earnedAt) earned.set(a.drillId, { drillId: a.drillId, name: d.name, tier: d.tier, earnedAt: a.startedAt, score: a.score });
  }
  const albums = new Map<string, RecordCard[]>();
  for (const r of earned.values()) albums.set(r.tier, [...(albums.get(r.tier) ?? []), r]);
  return albums;
}

/** "Ready for the next tier": bronze on the last three attempts of every drill in the tier. */
export function tierReady(attempts: readonly AttemptRecord[], drills: readonly Drill[], tier: string, passScore = 80): { ready: boolean; missing: string[] } {
  const inTier = drills.filter((d) => d.tier === tier);
  const missing: string[] = [];
  for (const d of inTier) {
    const last3 = attempts
      .filter((a) => a.drillId === d.id && a.score != null)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 3);
    if (last3.length < 3 || !last3.every((a) => (a.score ?? 0) >= (d.passScore ?? passScore))) missing.push(d.id);
  }
  return { ready: inTier.length > 0 && missing.length === 0, missing };
}
