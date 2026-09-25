import Dexie, { type EntityTable } from 'dexie';
import type { AttemptRecord } from '../scoring/attempt';
import type { ControlMap } from '../midi/map';
import type { ScoringThresholds } from '../drills/schema';

export interface StoredMap {
  /** Profile id, one map per profile. */
  profile: string;
  device?: string;
  entries: ControlMap;
  updatedAt: number;
}

export interface Settings {
  id: 'settings';
  theme: 'system' | 'light' | 'dark';
  click: boolean;
  loop: boolean;
  autoStart: boolean;
  /** Control that starts the clock when pressed while stopped. */
  autoStartControl: string;
  countInBars: number;
  strictness: number;
  inputOffsetMs: number;
  reducedMotion: boolean;
  thresholds: Partial<ScoringThresholds>;
  /** Piano defaults. */
  noteMode: 'wait' | 'play';
  hand: 'L' | 'R' | 'B';
  guide: boolean;
  lastProfile: string;
  lastDrill?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  theme: 'system',
  click: false,
  loop: false,
  autoStart: true,
  autoStartControl: 'playA',
  countInBars: 0,
  strictness: 1,
  inputOffsetMs: 0,
  reducedMotion: false,
  thresholds: {},
  noteMode: 'wait',
  hand: 'B',
  guide: false,
  lastProfile: 'flx4',
};

export class TrainerDb extends Dexie {
  attempts!: EntityTable<AttemptRecord, 'id'>;
  maps!: EntityTable<StoredMap, 'profile'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor(name = 'midi-trainer') {
    super(name);
    this.version(1).stores({
      attempts: '++id, drillId, startedAt, [drillId+startedAt]',
      maps: 'profile',
      settings: 'id',
    });
  }

  async getSettings(): Promise<Settings> {
    const s = await this.settings.get('settings');
    return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
  }

  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    const next = { ...(await this.getSettings()), ...patch, id: 'settings' as const };
    await this.settings.put(next);
    return next;
  }

  async getMap(profile: string): Promise<ControlMap> {
    return (await this.maps.get(profile))?.entries ?? {};
  }

  async saveMap(profile: string, entries: ControlMap, device?: string): Promise<void> {
    await this.maps.put({ profile, entries, updatedAt: Date.now(), ...(device ? { device } : {}) });
  }

  async attemptsFor(drillId: string): Promise<AttemptRecord[]> {
    return this.attempts.where('drillId').equals(drillId).sortBy('startedAt');
  }

  /** Best score per drill, derived from attempts (never stored separately). */
  async bestScores(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    await this.attempts.each((a) => {
      if (a.score == null) return;
      const cur = out[a.drillId];
      if (cur == null || a.score > cur) out[a.drillId] = a.score;
    });
    return out;
  }
}
