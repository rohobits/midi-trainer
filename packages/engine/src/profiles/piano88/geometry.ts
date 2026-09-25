export const PIANO_LO = 21; // A0
export const PIANO_HI = 108; // C8
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export function isBlack(n: number): boolean {
  const p = n % 12;
  return p === 1 || p === 3 || p === 6 || p === 8 || p === 10;
}

export function noteName(n: number): string {
  return `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
}

const whiteIndex: Record<number, number> = {};
let count = 0;
for (let n = PIANO_LO; n <= PIANO_HI; n++) if (!isBlack(n)) whiteIndex[n] = count++;
export const WHITE_KEYS = count;

export function whiteIdx(n: number): number {
  return whiteIndex[n] ?? -1;
}

export interface KeyRect {
  x: number;
  y: number;
  w: number;
  h: number;
  black: boolean;
}

export interface KeyboardMetrics {
  /** White key width. */
  kw: number;
  /** White key height. */
  kh: number;
  /** Black key width/height. */
  bw: number;
  bh: number;
  /** Top of the keyboard in canvas px. */
  top: number;
}

/** Prototype key sizing: white width = W / 52, height clamped 70..110 (≈ 6 widths). */
export function keyboardMetrics(width: number, height: number): KeyboardMetrics {
  const kw = width / WHITE_KEYS;
  const kh = Math.max(70, Math.min(110, kw * 6));
  return { kw, kh, bw: kw * 0.62, bh: kh * 0.62, top: height - kh };
}

export function keyRect(n: number, m: KeyboardMetrics): KeyRect {
  if (isBlack(n)) {
    const x = (whiteIdx(n - 1) + 1) * m.kw - m.bw / 2;
    return { x, y: m.top, w: m.bw, h: m.bh, black: true };
  }
  return { x: whiteIdx(n) * m.kw, y: m.top, w: m.kw, h: m.kh, black: false };
}

/** Hit test: black keys first (they sit on top), then whites. */
export function noteAt(px: number, py: number, m: KeyboardMetrics): number | null {
  for (let n = PIANO_LO; n <= PIANO_HI; n++) {
    if (!isBlack(n)) continue;
    const k = keyRect(n, m);
    if (px >= k.x && px <= k.x + k.w && py >= k.y && py <= k.y + k.h) return n;
  }
  for (let n = PIANO_LO; n <= PIANO_HI; n++) {
    if (isBlack(n)) continue;
    const k = keyRect(n, m);
    if (px >= k.x && px <= k.x + k.w && py >= k.y) return n;
  }
  return null;
}
