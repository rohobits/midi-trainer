import type { ControlDef, Profile } from '../profiles/types';

/** Lane colour families. Colour encodes what the control belongs to; silhouette encodes type. */
export type LaneGroup = 'deckA' | 'deckB' | 'mixer' | 'pads' | 'fx' | 'select' | 'lh' | 'rh';

export interface LanePalette {
  deckA: string;
  deckB: string;
  mixer: string;
  pads: string;
  fx: string;
  select: string;
  lh: string;
  rh: string;
}

export const DEFAULT_PALETTE: LanePalette = {
  deckA: '#38d5ff',
  deckB: '#ffb13b',
  mixer: '#ff4fa8',
  pads: '#b6f23a',
  fx: '#9f84ff',
  select: '#e9edf5',
  lh: '#ffb13b',
  rh: '#38d5ff',
};

/** Which colour family a control belongs to. */
export function laneGroupOf(c: ControlDef): LaneGroup {
  if (c.group === 'FX' || c.group === 'Smart' || c.mode === 'PAD FX' || c.mode === 'PAD FX 2') return 'fx';
  if (c.mode === 'SAMPLER') return 'pads';
  if (c.group === 'Browse') return 'select';
  if (!c.deck) return c.group === 'Mixer' ? 'mixer' : 'select';
  return c.deck === 'A' ? 'deckA' : 'deckB';
}

export function laneGroups(profile: Profile): Record<string, LaneGroup> {
  return Object.fromEntries(profile.controls.map((c) => [c.id, laneGroupOf(c)]));
}

/** Parse #rrggbb to [r,g,b]. */
export function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Mix two hex colours, k = 0 → a, 1 → b. */
export function mix(a: string, b: string, k: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * k);
  return `rgb(${c(r1, r2)},${c(g1, g2)},${c(b1, b2)})`;
}

/** Desaturated, dim version for missed targets (luminance ≈ 0.25). */
export function dimmed(hex: string): string {
  const [r, g, b] = rgb(hex);
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const v = Math.round(l * 0.35 + 30);
  return `rgb(${v},${v},${v})`;
}
