import type { Drill, PrimitiveTarget, Target } from './schema';

export type ControlKindMap = Readonly<Record<string, 'tap' | 'cc' | 'rel'>>;

export interface GroupInfo {
  id: number;
  kind: 'alternate' | 'step' | 'sequence';
  index: number;
  size: number;
}

/** A primitive target plus its position in the compound target it came from, if any. */
export type ExpandedTarget = PrimitiveTarget & { group?: GroupInfo };

/**
 * Expand compound targets (alternate, step, sequence) into primitives. Compound targets keep
 * their meaning in the file; judges only see primitives. `kinds` decides whether an alternate
 * on a control becomes presses (tap) or value flips (cut); unknown controls are presses.
 */
export function expandTargets(targets: readonly Target[], kinds: ControlKindMap = {}): ExpandedTarget[] {
  const out: ExpandedTarget[] = [];
  let groupId = 0;
  for (const t of targets) {
    switch (t.type) {
      case 'alternate': {
        const id = groupId++;
        const isCc = kinds[t.c] === 'cc';
        const v0 = t.v0 ?? 0;
        const v1 = t.v1 ?? 1;
        for (let i = 0; i < t.n; i++) {
          const at = t.t + i * t.step;
          const group: GroupInfo = { id, kind: 'alternate', index: i, size: t.n };
          if (isCc) out.push({ type: 'cut', c: t.c, t: at, v0: i % 2 === 0 ? v0 : v1, v1: i % 2 === 0 ? v1 : v0, group });
          else out.push({ type: 'tap', c: t.c, t: at, group });
        }
        break;
      }
      case 'step': {
        const id = groupId++;
        const size = t.count + (t.exitAt != null ? 1 : 0);
        for (let i = 0; i < t.count; i++) out.push({ type: 'tap', c: t.c, t: t.t + i * t.step, group: { id, kind: 'step', index: i, size } });
        if (t.exitAt != null) out.push({ type: 'tap', c: t.exitC ?? t.c, t: t.exitAt, group: { id, kind: 'step', index: t.count, size } });
        break;
      }
      case 'sequence': {
        const id = groupId++;
        t.steps.forEach((s, i) => {
          const group: GroupInfo = { id, kind: 'sequence', index: i, size: t.steps.length };
          const shifted = shift(s, t.t);
          out.push({ ...shifted, group });
        });
        break;
      }
      default:
        out.push(t);
    }
  }
  return out;
}

function shift(s: PrimitiveTarget, by: number): PrimitiveTarget {
  switch (s.type) {
    case 'tap':
    case 'cut':
      return { ...s, t: s.t + by };
    case 'note':
      return { ...s, t: s.t + by };
    default:
      return { ...s, t: s.t + by, t1: s.t1 + by };
  }
}

export function expandDrill(drill: Pick<Drill, 'targets'>, kinds?: ControlKindMap): ExpandedTarget[] {
  return expandTargets(drill.targets, kinds);
}

/** Controls referenced by a target, expanded or not. */
export function targetControls(t: Target): string[] {
  switch (t.type) {
    case 'note':
      return [];
    case 'cross':
      return [t.c, t.c2];
    case 'select':
      return [...new Set([t.c, ...t.choices])];
    case 'step':
      return t.exitC ? [t.c, t.exitC] : [t.c];
    case 'sequence':
      return [...new Set(t.steps.flatMap(targetControls))];
    default:
      return [t.c];
  }
}

/** End beat of a target. */
export function targetEnd(t: Target): number {
  switch (t.type) {
    case 'tap':
    case 'cut':
      return t.t;
    case 'note':
      return t.t + t.d;
    case 'alternate':
      return t.t + (t.n - 1) * t.step;
    case 'step':
      return Math.max(t.t + (t.count - 1) * t.step, t.exitAt ?? 0);
    case 'sequence':
      return t.t + Math.max(...t.steps.map(targetEnd));
    default:
      return t.t1;
  }
}
