import type { Drill } from './schema';

/** Lanes for a drill: explicit `lanes`, else controls in order of first appearance. */
export function lanesFor(drill: Pick<Drill, 'lanes' | 'targets'>): string[] {
  if (drill.lanes && drill.lanes.length) return [...drill.lanes];
  const seen: string[] = [];
  for (const t of drill.targets) {
    if (t.type === 'note') continue;
    if (!seen.includes(t.c)) seen.push(t.c);
  }
  return seen;
}

/** Every control a drill uses (excluding piano notes). */
export function controlsFor(drill: Pick<Drill, 'targets'>): string[] {
  const set = new Set<string>();
  for (const t of drill.targets) if (t.type !== 'note') set.add(t.c);
  return [...set];
}

/** Drill length in beats. Bars × beats-per-bar, or the last target end if longer. */
export function lengthBeats(drill: Pick<Drill, 'bars' | 'timeSig' | 'targets'>): number {
  const bpb = drill.timeSig?.[0] ?? 4;
  let last = 0;
  for (const t of drill.targets) {
    const end = t.type === 'tap' ? t.t : t.type === 'note' ? t.t + t.d : t.t1;
    if (end > last) last = end;
  }
  return Math.max(drill.bars * bpb, last);
}
