import { parseDrill, parseTrackPool, formatDrillError, type Drill, type Track } from '@midi-trainer/engine';

const modules = import.meta.glob('../../../content/drills/**/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const extras = import.meta.glob('../../../content/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

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

export interface PathDef {
  id: string;
  name: string;
  description: string;
  levels: { level: number; name: string }[];
}

export interface GenreDef {
  id: string;
  name: string;
  bpmRange: [number, number];
  transitionBars: number;
  notes: string;
  sources?: string[];
}

const DEFAULT_PATHS: PathDef[] = [
  { id: 'pads', name: 'Pads', description: 'Timing on hot cues, samplers and pad FX.', levels: [1, 2, 3, 4, 5].map((l) => ({ level: l, name: `Level ${l}` })) },
  { id: 'mixer', name: 'Mixer', description: 'Faders, EQ, filter and gain.', levels: [1, 2, 3, 4, 5].map((l) => ({ level: l, name: `Level ${l}` })) },
  { id: 'transitions', name: 'Transitions', description: 'Whole handovers from one track to the next.', levels: [1, 2, 3, 4, 5].map((l) => ({ level: l, name: `Level ${l}` })) },
  { id: 'jog', name: 'Jog', description: 'Nudges, beatmatching and scratching.', levels: [1, 2, 3, 4, 5].map((l) => ({ level: l, name: `Level ${l}` })) },
  { id: 'fx', name: 'FX', description: 'Loops, rolls, echo and builds.', levels: [1, 2, 3, 4, 5].map((l) => ({ level: l, name: `Level ${l}` })) },
  { id: 'combined', name: 'Combined', description: 'Both hands at once.', levels: [1, 2, 3, 4, 5].map((l) => ({ level: l, name: `Level ${l}` })) },
];

export function paths(): PathDef[] {
  const raw = Object.entries(extras).find(([k]) => k.endsWith('/paths.json'))?.[1];
  return Array.isArray(raw) && raw.length ? (raw as PathDef[]) : DEFAULT_PATHS;
}

export function genres(): GenreDef[] {
  const raw = Object.entries(extras).find(([k]) => k.endsWith('/genres.json'))?.[1];
  return Array.isArray(raw) ? (raw as GenreDef[]) : [{ id: 'house', name: 'House', bpmRange: [120, 128], transitionBars: 16, notes: 'Outro to intro, bass swap on the phrase.' }];
}

let pool: Track[] | null = null;
/** The suggested-track pool, validated once. */
export function tracks(): Track[] {
  if (!pool) {
    const raw = Object.entries(extras).find(([k]) => k.endsWith('/tracks.json'))?.[1];
    pool = raw ? parseTrackPool(raw) : [];
  }
  return pool;
}

export function trackById(id: string): Track | undefined {
  return tracks().find((t) => t.id === id);
}

export const TIER_ORDER = ['Foundations', 'Mixing', 'Performance', 'Advanced', 'Pro', 'Week 1', 'Generated', 'Daily', 'Custom'];

export function tierRank(tier: string): number {
  const i = TIER_ORDER.indexOf(tier);
  return i < 0 ? TIER_ORDER.length : i;
}
