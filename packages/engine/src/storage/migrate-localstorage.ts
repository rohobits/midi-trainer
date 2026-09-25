import { importMap, type ControlMap } from '../midi/map';
import type { Settings } from './db';

export interface LegacyData {
  map: ControlMap | null;
  /** Prototype best scores keyed by drill *name*. */
  bestByName: Record<string, number> | null;
  settings: Partial<Settings>;
}

interface StorageLike {
  getItem(key: string): string | null;
}

/**
 * Read the prototypes' localStorage keys (`djt-map`, `djt-best`, `djt-settings`,
 * `pt-settings`). Pure over a Storage-like object so it is testable; nothing is removed.
 */
export function readLegacy(storage: StorageLike): LegacyData {
  const json = <T>(key: string): T | null => {
    try {
      const raw = storage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  };
  let map: ControlMap | null = null;
  const rawMap = json<Record<string, string>>('djt-map');
  if (rawMap && Object.keys(rawMap).length) {
    try {
      map = importMap(rawMap).map;
    } catch {
      map = null;
    }
  }
  const bestByName = json<Record<string, number>>('djt-best');
  const dj = json<{ click?: boolean; loop?: boolean; auto?: boolean }>('djt-settings') ?? {};
  const pt = json<{ mode?: 'wait' | 'play'; hand?: 'L' | 'R' | 'B'; guide?: boolean; click?: boolean }>('pt-settings') ?? {};
  const settings: Partial<Settings> = {};
  if (dj.click != null || pt.click != null) settings.click = !!(dj.click ?? pt.click);
  if (dj.loop != null) settings.loop = !!dj.loop;
  if (dj.auto != null) settings.autoStart = dj.auto !== false;
  if (pt.mode) settings.noteMode = pt.mode;
  if (pt.hand) settings.hand = pt.hand;
  if (pt.guide != null) settings.guide = !!pt.guide;
  return { map, bestByName: bestByName && Object.keys(bestByName).length ? bestByName : null, settings };
}
