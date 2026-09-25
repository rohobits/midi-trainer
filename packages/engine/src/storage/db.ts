import Dexie, { type EntityTable } from 'dexie';
import type { AttemptRecord } from '../scoring/attempt';
import type { ControlMap } from '../midi/map';
import type { Drill, ScoringThresholds } from '../drills/schema';

export interface StoredMap {
  /** Profile id, one map per profile. */
  profile: string;
  device?: string;
  entries: ControlMap;
  updatedAt: number;
}

export interface StoredDrill {
  id: string;
  drill: Drill;
  source: 'custom' | 'generated' | 'daily' | 'imported';
  createdAt: number;
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
  /** Daily practice goal in minutes. */
  goalMinutes: number;
  /** Cosmetics. */
  cosmeticTheme: string;
  laneSkin: string;
  /** Practice tools. */
  tempoScale: number;
  waitMode: boolean;
  masterMode: boolean;
  showHitWindow: boolean;
  showGhost: boolean;
  performanceMode: boolean;
  /** Per-device input offsets, by input name. */
  deviceOffsets: Record<string, number>;
  /** Follow an incoming MIDI clock's BPM when present. */
  followMidiClock: boolean;
  genre: string;
  /** Auto-BPM ladder: pass at 80% → 90% → 100%. */
  autoBpm: boolean;
  isolation: 'all' | 'A' | 'B' | 'mixer';
  showController: boolean;
  muteSfx: boolean;
  /** Beats visible above the strike line. */
  lookahead: number;
  /** Highway perspective strength. */
  fov: number;
  onboarded: boolean;
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
  goalMinutes: 5,
  cosmeticTheme: 'default',
  laneSkin: 'lanes-classic',
  tempoScale: 1,
  waitMode: false,
  masterMode: false,
  showHitWindow: true,
  showGhost: false,
  performanceMode: false,
  deviceOffsets: {},
  followMidiClock: false,
  genre: 'house',
  autoBpm: false,
  isolation: 'all',
  showController: false,
  muteSfx: false,
  lookahead: 8,
  fov: 1.6,
  onboarded: false,
};

export class TrainerDb extends Dexie {
  attempts!: EntityTable<AttemptRecord, 'id'>;
  maps!: EntityTable<StoredMap, 'profile'>;
  settings!: EntityTable<Settings, 'id'>;
  drills!: EntityTable<StoredDrill, 'id'>;

  constructor(name = 'midi-trainer') {
    super(name);
    this.version(1).stores({
      attempts: '++id, drillId, startedAt, [drillId+startedAt]',
      maps: 'profile',
      settings: 'id',
    });
    this.version(2).stores({
      attempts: '++id, drillId, startedAt, [drillId+startedAt]',
      maps: 'profile',
      settings: 'id',
      drills: 'id, source, createdAt',
    });
  }

  async allAttempts(): Promise<AttemptRecord[]> {
    return this.attempts.orderBy('startedAt').toArray();
  }

  async storedDrills(): Promise<StoredDrill[]> {
    return this.drills.orderBy('createdAt').toArray();
  }

  async saveDrill(drill: Drill, source: StoredDrill['source']): Promise<void> {
    await this.drills.put({ id: drill.id, drill, source, createdAt: Date.now() });
  }

  /** Everything, for backup. */
  async exportAll(): Promise<{ version: 2; exportedAt: number; settings: Settings; maps: StoredMap[]; attempts: AttemptRecord[]; drills: StoredDrill[] }> {
    return { version: 2, exportedAt: Date.now(), settings: await this.getSettings(), maps: await this.maps.toArray(), attempts: await this.allAttempts(), drills: await this.storedDrills() };
  }

  async importAll(data: { settings?: Partial<Settings>; maps?: StoredMap[]; attempts?: AttemptRecord[]; drills?: StoredDrill[] }): Promise<void> {
    await this.transaction('rw', [this.settings, this.maps, this.attempts, this.drills], async () => {
      if (data.settings) await this.saveSettings(data.settings);
      for (const m of data.maps ?? []) await this.maps.put(m);
      for (const a of data.attempts ?? []) {
        const { id: _id, ...rest } = a;
        await this.attempts.add(rest as AttemptRecord);
      }
      for (const d of data.drills ?? []) await this.drills.put(d);
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
