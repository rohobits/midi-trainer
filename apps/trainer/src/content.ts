import { parseDrill, formatDrillError, type Drill } from '@midi-trainer/engine';

const modules = import.meta.glob('../../../content/drills/**/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

/** Built-in drills, validated at load. A bad file throws with its path so it never ships. */
export function builtinDrills(): Drill[] {
  const out: Drill[] = [];
  for (const [file, raw] of Object.entries(modules).sort(([a], [b]) => a.localeCompare(b))) {
    try {
      out.push(parseDrill(raw));
    } catch (e) {
      throw new Error(`Invalid drill ${file}:\n${formatDrillError(e)}`);
    }
  }
  return out;
}

export const TIER_ORDER = ['Foundations', 'Mixing', 'Performance', 'Advanced', 'Pro'];

export function tierRank(tier: string): number {
  const i = TIER_ORDER.indexOf(tier);
  return i < 0 ? TIER_ORDER.length : i;
}
