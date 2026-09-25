export type ControlKind = 'tap' | 'cc';

export interface ControlDef {
  id: string;
  /** Name as printed on the hardware. */
  name: string;
  kind: ControlKind;
  /** Resting value for continuous controls (faders 0, knobs centred 0.5). */
  defaultValue?: number;
  /** Panel group for the learn UI and layout. */
  group: string;
  deck?: 'A' | 'B';
  /** Pad mode this control belongs to, if any. */
  mode?: string;
}

export interface Profile {
  id: string;
  name: string;
  /** Whether targets are controls (`c`) or notes (`n`). */
  input: 'controls' | 'notes';
  controls: readonly ControlDef[];
  /** Capabilities this hardware provides, matched against `Drill.requires`. */
  capabilities: readonly string[];
}

export function controlById(profile: Profile): Record<string, ControlDef> {
  return Object.fromEntries(profile.controls.map((c) => [c.id, c]));
}

/** Resting value for every control (prototype: faders/crossfader/FX level at 0, others at 0.5, taps 0). */
export function defaultValues(profile: Profile): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of profile.controls) out[c.id] = c.kind === 'cc' ? (c.defaultValue ?? 0.5) : 0;
  return out;
}
