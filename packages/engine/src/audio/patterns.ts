import { mulberry32 } from '../game/random';

/**
 * Pure pattern generation for the synthesized practice tracks. Steps are 16ths over a
 * 4-bar loop (64 steps). Everything here is deterministic from a seed so a "track" can be
 * regenerated anywhere and beat-gridded exactly.
 */
export const STEPS_PER_BAR = 16;
export const LOOP_BARS = 4;
export const LOOP_STEPS = STEPS_PER_BAR * LOOP_BARS;

export type Genre = 'house' | 'tech-house' | 'techno' | 'trance' | 'drum-and-bass' | 'dubstep' | 'hip-hop';

export interface TrackSpec {
  id: string;
  name: string;
  seed: number;
  bpm: number;
  /** Pitch class of the root, 0 = C. */
  root: number;
  minor: boolean;
  genre: Genre;
  bars: number;
  sections: Section[];
}

export type SectionKind = 'intro' | 'build' | 'drop' | 'break' | 'outro';

export interface Section {
  kind: SectionKind;
  /** 0-based bar. */
  start: number;
  bars: number;
  /** Stem gains 0..1 during the section. */
  stems: Record<StemName, number>;
}

export type StemName = 'kick' | 'clap' | 'hat' | 'bass' | 'pad' | 'riser';
export const STEM_NAMES: readonly StemName[] = ['kick', 'clap', 'hat', 'bass', 'pad', 'riser'];

export interface Patterns {
  kick: boolean[];
  clap: boolean[];
  /** 0 = rest, 1 = closed, 2 = open. */
  hat: number[];
  /** MIDI note per step or null. */
  bass: (number | null)[];
  /** Chord root MIDI note per bar (4 bars). */
  chords: number[][];
}

const GENRE_BPM: Record<Genre, [number, number]> = {
  house: [122, 128], 'tech-house': [124, 128], techno: [128, 138], trance: [136, 142], 'drum-and-bass': [170, 176], dubstep: [138, 142], 'hip-hop': [86, 96],
};

export function genreBpm(genre: Genre, seed: number): number {
  const [lo, hi] = GENRE_BPM[genre];
  const rnd = mulberry32(seed);
  return lo + Math.round(rnd() * (hi - lo));
}

/** Scale degrees for a minor or major key, as semitone offsets. */
function scale(minor: boolean): number[] {
  return minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
}

export function makePatterns(spec: Pick<TrackSpec, 'seed' | 'root' | 'minor' | 'genre'>): Patterns {
  const rnd = mulberry32(spec.seed ^ 0x9e3779b9);
  const kick: boolean[] = new Array(LOOP_STEPS).fill(false);
  const clap: boolean[] = new Array(LOOP_STEPS).fill(false);
  const hat: number[] = new Array(LOOP_STEPS).fill(0);
  const bass: (number | null)[] = new Array(LOOP_STEPS).fill(null);
  const halfTime = spec.genre === 'dubstep' || spec.genre === 'hip-hop';
  const dnb = spec.genre === 'drum-and-bass';
  for (let s = 0; s < LOOP_STEPS; s++) {
    const inBar = s % STEPS_PER_BAR;
    if (dnb) {
      kick[s] = inBar === 0 || inBar === 10;
      clap[s] = inBar === 4 || inBar === 12;
      hat[s] = inBar % 2 === 0 ? 1 : rnd() < 0.3 ? 1 : 0;
    } else if (halfTime) {
      kick[s] = inBar === 0 || (inBar === 10 && rnd() < 0.6);
      clap[s] = inBar === 8;
      hat[s] = inBar % 2 === 0 ? 1 : rnd() < 0.25 ? 1 : 0;
      if (spec.genre === 'hip-hop' && inBar === 6 && rnd() < 0.5) kick[s] = true;
    } else {
      kick[s] = inBar % 4 === 0;
      clap[s] = inBar === 4 || inBar === 12;
      hat[s] = inBar % 2 === 1 ? 2 : inBar % 4 === 2 ? 1 : 0;
      if (spec.genre === 'techno' && inBar % 4 === 3 && rnd() < 0.35) hat[s] = 1;
    }
  }
  // bass: offbeat 8ths on the root with occasional 5th / 7th, per genre feel
  const deg = scale(spec.minor);
  const rootMidi = 36 + spec.root;
  for (let s = 0; s < LOOP_STEPS; s++) {
    const inBar = s % STEPS_PER_BAR;
    const bar = Math.floor(s / STEPS_PER_BAR);
    let play = false;
    if (dnb) play = inBar === 0 || inBar === 6 || inBar === 10;
    else if (halfTime) play = inBar === 0 || inBar === 3 || inBar === 8 || inBar === 11;
    else play = inBar % 4 === 2 || (spec.genre === 'trance' && inBar % 2 === 0);
    if (!play) continue;
    const pick = rnd();
    const degree = pick < 0.7 ? 0 : pick < 0.85 ? 4 : bar % 2 ? 6 : 2;
    bass[s] = rootMidi + deg[degree]!;
  }
  // chord progression: i, VI, III, VII (minor) or I, V, vi, IV (major)
  const prog = spec.minor ? [0, 5, 2, 6] : [0, 4, 5, 3];
  const chords = prog.map((d) => {
    const base = 48 + spec.root + deg[d]!;
    const third = spec.minor ? (d === 0 || d === 3 || d === 4 ? 3 : 4) : d === 5 ? 3 : 4;
    return [base, base + third, base + 7];
  });
  return { kick, clap, hat, bass, chords };
}

/** Standard arrangement: intro, build, drop, break, build, drop, outro. */
export function makeSections(bars: number, genre: Genre): Section[] {
  const g = (kick: number, clap: number, hat: number, bass: number, pad: number, riser: number): Record<StemName, number> => ({ kick, clap, hat, bass, pad, riser });
  const out: Section[] = [];
  let at = 0;
  const push = (kind: SectionKind, n: number, stems: Record<StemName, number>) => {
    if (at >= bars) return;
    const len = Math.min(n, bars - at);
    out.push({ kind, start: at, bars: len, stems });
    at += len;
  };
  const hatIntro = genre === 'techno' ? 0.8 : 0.6;
  push('intro', 16, g(1, 0, hatIntro, 0, 0.6, 0));
  push('build', 8, g(1, 1, 1, 0.5, 0.8, 1));
  push('drop', 32, g(1, 1, 1, 1, 0.9, 0));
  push('break', 16, g(0, 0, 0.3, 0, 1, 0.6));
  push('build', 8, g(1, 1, 1, 0.6, 0.9, 1));
  push('drop', 32, g(1, 1, 1, 1, 1, 0));
  push('outro', 16, g(1, 0, 0.7, 0.5, 0, 0));
  while (at < bars) push('outro', bars - at, g(1, 0, 0.5, 0, 0, 0));
  return out;
}

export function makeTrack(seed: number, genre: Genre = 'house', bars = 128): TrackSpec {
  const rnd = mulberry32(seed);
  const root = Math.floor(rnd() * 12);
  const minor = rnd() < 0.7;
  const names = ['Night Drive', 'Concrete', 'Afterglow', 'Undertow', 'Pulse', 'Basement', 'Signal', 'Voltage', 'Ember', 'Lowline', 'Orbit', 'Haze'];
  const name = `${names[seed % names.length]} ${(seed % 97) + 1}`;
  return { id: `synth-${genre}-${seed}`, name, seed, bpm: genreBpm(genre, seed), root, minor, genre, bars, sections: makeSections(bars, genre) };
}

/** Camelot code for a key (e.g. 8A = A minor). */
export function camelot(root: number, minor: boolean): string {
  // Order of fifths starting at C: C G D A E B F# C# G# D# A# F → 8B 9B 10B 11B 12B 1B 2B 3B 4B 5B 6B 7B
  const fifths = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
  const idx = fifths.indexOf(((root % 12) + 12) % 12);
  const majorNum = ((idx + 7) % 12) + 1; // C = 8B
  const minorNum = ((idx + 4) % 12) + 1; // A minor = 8A → A is idx 3 → (3+4)%12+1 = 8
  return minor ? `${minorNum}A` : `${majorNum}B`;
}

/** Whether two keys are Camelot-compatible: same, ±1 number, or same number other letter. */
export function camelotCompatible(a: string, b: string): boolean {
  const pa = /^(\d+)([AB])$/.exec(a);
  const pb = /^(\d+)([AB])$/.exec(b);
  if (!pa || !pb) return false;
  const na = Number(pa[1]);
  const nb = Number(pb[1]);
  if (pa[2] === pb[2]) return na === nb || Math.abs(na - nb) === 1 || Math.abs(na - nb) === 11;
  return na === nb;
}

/** Section active at a bar, if any. */
export function sectionAt(spec: TrackSpec, bar: number): Section | null {
  return spec.sections.find((s) => bar >= s.start && bar < s.start + s.bars) ?? null;
}
