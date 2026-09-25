import {
  MidiAccess, Sounds, TrainerDb, MidiClock, FLX4_PROFILE, GENERIC_PROFILE, DEFAULT_SETTINGS, FLX4_DEFAULT_MAP,
  controlById, controlKinds, defaultValues, mappedControls, reverseMap, lookupControl, switchKey, relativeDelta, readLegacy, totalXp, levelFor, xpForAttempt,
  practiceByDay, streakInfo,
  type ControlMap, type Drill, type MidiEvent, type Profile, type Settings, type AttemptRecord, type StoredDrill,
} from '@midi-trainer/engine';
import { builtinDrills } from './content';
import { $, el } from './ui/dom';
import { createLearnUi, type LearnUi } from './ui/learn';
import { toast } from './ui/toast';
import { Sfx } from './ui/sfx';

export const PROFILES: Record<string, Profile> = { flx4: FLX4_PROFILE, generic: GENERIC_PROFILE };

/** A resolved control event: MIDI (or on-screen) input already mapped to a control id. */
export type ControlEvent =
  | { kind: 'tap'; c: string; timeStamp: number }
  | { kind: 'release'; c: string; timeStamp: number }
  | { kind: 'cc'; c: string; value: number; timeStamp: number }
  | { kind: 'rel'; c: string; delta: number; timeStamp: number }
  | { kind: 'noteon'; note: number; velocity: number; timeStamp: number }
  | { kind: 'noteoff'; note: number; timeStamp: number };

type Events = {
  control: ControlEvent;
  settings: Settings;
  map: ControlMap;
  attempts: AttemptRecord[];
  drills: Drill[];
  midi: { ev: MidiEvent; timeStamp: number; mapped: string | null };
  clock: MidiClock;
};

export class App {
  db = new TrainerDb();
  settings: Settings = { ...DEFAULT_SETTINGS };
  profile: Profile = FLX4_PROFILE;
  map: ControlMap = {};
  rev: Record<string, string> = {};
  values: Record<string, number> = {};
  drills: Drill[] = [];
  stored: StoredDrill[] = [];
  attempts: AttemptRecord[] = [];
  best: Record<string, number> = {};
  midi = new MidiAccess();
  sounds = new Sounds();
  clock = new MidiClock();
  sfx = new Sfx();
  learn: LearnUi | null = null;
  deviceName = '';
  private listeners = new Map<keyof Events, Set<(v: never) => void>>();

  on<K extends keyof Events>(event: K, fn: (v: Events[K]) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn as (v: never) => void);
    return () => set!.delete(fn as (v: never) => void);
  }

  private emit<K extends keyof Events>(event: K, v: Events[K]): void {
    this.listeners.get(event)?.forEach((fn) => (fn as (x: Events[K]) => void)(v));
  }

  async boot(): Promise<void> {
    await this.migrateLegacy();
    this.settings = await this.db.getSettings();
    this.applyTheme();
    await this.reloadDrills();
    await this.reloadAttempts();
    const profileSel = $<HTMLSelectElement>('profile');
    for (const p of Object.values(PROFILES)) profileSel.appendChild(el('option', { value: p.id }, p.name));
    profileSel.value = this.settings.lastProfile in PROFILES ? this.settings.lastProfile : 'flx4';
    profileSel.onchange = () => void this.setProfile(profileSel.value);
    await this.setProfile(profileSel.value);
    this.wireMidi();
  }

  private async migrateLegacy(): Promise<void> {
    if (await this.db.settings.get('settings')) return;
    const legacy = readLegacy(localStorage);
    if (legacy.map) await this.db.saveMap('generic', legacy.map);
    if (Object.keys(legacy.settings).length) await this.db.saveSettings({ ...legacy.settings, lastProfile: legacy.map ? 'generic' : 'flx4' });
    else await this.db.saveSettings({});
  }

  async reloadDrills(): Promise<void> {
    this.stored = await this.db.storedDrills();
    const builtin = builtinDrills();
    const ids = new Set(builtin.map((d) => d.id));
    this.drills = [...builtin, ...this.stored.filter((s) => !ids.has(s.id)).map((s) => s.drill)];
    this.emit('drills', this.drills);
  }

  async reloadAttempts(): Promise<void> {
    this.attempts = await this.db.allAttempts();
    this.best = {};
    for (const a of this.attempts) {
      if (a.score == null) continue;
      const cur = this.best[a.drillId];
      if (cur == null || a.score > cur) this.best[a.drillId] = a.score;
    }
    this.emit('attempts', this.attempts);
  }

  drill(id: string): Drill | undefined {
    return this.drills.find((d) => d.id === id);
  }

  async addDrill(d: Drill, source: StoredDrill['source']): Promise<void> {
    await this.db.saveDrill(d, source);
    await this.reloadDrills();
  }

  async removeDrill(id: string): Promise<void> {
    await this.db.drills.delete(id);
    await this.reloadDrills();
  }

  /** Save an attempt; returns whether it was a personal best and the XP it earned. */
  async addAttempt(a: AttemptRecord): Promise<{ isPb: boolean; xp: number; level: number; leveledUp: boolean; streak: ReturnType<typeof streakInfo> }> {
    const prevXp = totalXp(this.attempts);
    const prevLevel = levelFor(prevXp).level;
    const prev = this.best[a.drillId];
    const isPb = a.score != null && (prev == null || a.score > prev);
    const xp = xpForAttempt(a, isPb);
    await this.db.attempts.add(a);
    await this.reloadAttempts();
    const level = levelFor(prevXp + xp).level;
    const streak = streakInfo(practiceByDay(this.attempts, this.settings.goalMinutes));
    return { isPb, xp, level, leveledUp: level > prevLevel, streak };
  }

  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    this.settings = await this.db.saveSettings(patch);
    this.applyTheme();
    this.emit('settings', this.settings);
    return this.settings;
  }

  applyTheme(): void {
    const root = document.documentElement;
    const t = this.settings.theme;
    const cosmetic = this.settings.cosmeticTheme;
    // Dark is the design and the default whatever the OS says; light is an explicit opt-in.
    if (cosmetic && cosmetic !== 'default') root.dataset.theme = cosmetic;
    else if (t === 'light') root.dataset.theme = 'light';
    else root.dataset.theme = 'dark';
    root.dataset.lanes = this.settings.laneSkin;
    root.dataset.reduced = this.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches ? '1' : '0';
    this.sfx.muted = this.settings.muteSfx;
  }

  get reducedMotion(): boolean {
    return document.documentElement.dataset.reduced === '1';
  }

  /** Call from any user gesture: unlocks metronome/guide sounds and UI sfx. */
  unlockAudio(): void {
    this.sounds.ensure();
    this.sfx.unlock();
  }

  async setProfile(id: string): Promise<void> {
    this.profile = PROFILES[id] ?? FLX4_PROFILE;
    this.map = await this.db.getMap(this.profile.id);
    if (!Object.keys(this.map).length && this.profile.id === 'flx4') {
      this.map = structuredClone(FLX4_DEFAULT_MAP);
      await this.db.saveMap('flx4', this.map);
    }
    this.rev = reverseMap(this.map);
    this.values = defaultValues(this.profile);
    this.learn = createLearnUi(this.profile, this.map, (map) => {
      this.rev = reverseMap(map);
      void this.db.saveMap(this.profile.id, map, this.deviceName || undefined);
      this.emit('map', map);
    });
    await this.saveSettings({ lastProfile: this.profile.id });
    this.emit('map', this.map);
  }

  names(): Record<string, string> {
    return Object.fromEntries(this.profile.controls.map((c) => [c.id, c.name]));
  }

  kinds(): Record<string, 'tap' | 'cc' | 'rel' | 'switch'> {
    return controlKinds(this.profile);
  }

  mapped(): Set<string> {
    return mappedControls(this.map);
  }

  controlName(c: string): string {
    return controlById(this.profile)[c]?.name ?? c;
  }

  get xp(): { total: number; level: number; into: number; next: number } {
    const total = totalXp(this.attempts);
    return { total, ...levelFor(total) };
  }

  private wireMidi(): void {
    const setStatus = (names: string[]) => {
      const on = names.length > 0;
      $('dot').classList.toggle('on', on);
      $('devname').textContent = on ? names.join(', ') : 'No controller found. Power it on, plug USB, click Connect.';
      this.deviceName = names[0] ?? '';
      const off = this.settings.deviceOffsets[this.deviceName];
      if (off != null && off !== this.settings.inputOffsetMs) void this.saveSettings({ inputOffsetMs: off });
    };
    this.midi.onStateChange((inputs) => setStatus(inputs.map((i) => i.name)));
    this.midi.onEvent((ev, meta) => this.handleMidi(ev, meta.timeStamp));
    this.midi.onRaw((bytes, ts) => {
      if (this.clock.feed(bytes, ts)) this.emit('clock', this.clock);
    });
    const connect = async () => {
      try {
        setStatus((await this.midi.connect()).map((i) => i.name));
      } catch (e) {
        $('devname').textContent = MidiAccess.supported ? 'MIDI access blocked. Allow MIDI for this page in the browser site settings.' : (e as Error).message;
      }
    };
    $('midiBtn').onclick = connect;
    if (MidiAccess.supported) void connect();
    else $('devname').textContent = 'No Web MIDI here. Use Chrome or Edge.';
  }

  handleMidi(ev: MidiEvent, timeStamp: number): void {
    if (this.learn?.offer(ev)) return;
    const c = lookupControl(this.rev, ev.key, switchKey(ev));
    this.emit('midi', { ev, timeStamp, mapped: c ?? null });
    // Piano profile: raw notes are the instrument.
    if (ev.kind === 'noteon') this.emit('control', { kind: 'noteon', note: ev.note, velocity: ev.velocity, timeStamp });
    if (ev.kind === 'noteoff') this.emit('control', { kind: 'noteoff', note: ev.note, timeStamp });
    if (!c) return;
    const kind = this.kinds()[c];
    if (ev.kind === 'cc') {
      if (kind === 'rel') this.emit('control', { kind: 'rel', c, delta: relativeDelta(ev.raw), timeStamp });
      else {
        this.values[c] = ev.value;
        this.emit('control', { kind: 'cc', c, value: ev.value, timeStamp });
      }
    } else if (ev.kind === 'noteon' || kind === 'switch') this.emit('control', { kind: 'tap', c, timeStamp });
    else this.emit('control', { kind: 'release', c, timeStamp });
  }

  /** On-screen controller and tests: inject a control event directly (bypasses the map). */
  virtual(ev: ControlEvent): void {
    if (ev.kind === 'cc') this.values[ev.c] = ev.value;
    this.emit('control', ev);
  }

  toast(text: string, ms = 2200): void {
    toast(text, ms);
  }
}
