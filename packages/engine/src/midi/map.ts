import { z } from 'zod';

/** One mapped control: the MIDI key it listens to and whether it was seen on real hardware. */
export const MapEntry = z.object({
  key: z.string().regex(/^[nc]:\d{1,2}:\d{1,3}(@(\d{1,3}|off))?$/),
  verified: z.boolean().default(false),
  /** Free text: "learned 2026-09-25 on FLX4 fw 1.02", or a source URL for transcribed maps. */
  note: z.string().optional(),
});
export type MapEntry = z.infer<typeof MapEntry>;

export const ControlMapFile = z.object({
  version: z.literal(1),
  profile: z.string(),
  device: z.string().optional(),
  entries: z.record(z.string(), MapEntry),
});
export type ControlMapFile = z.infer<typeof ControlMapFile>;

export type ControlMap = Record<string, MapEntry>;

/** MIDI key → control id. Later entries win on collision. Qualified switch keys are kept as-is. */
export function reverseMap(map: ControlMap): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [control, entry] of Object.entries(map)) out[entry.key] = control;
  return out;
}

/** Resolve an event to a control: the qualified (switch) key first, then the plain key. */
export function lookupControl(rev: Readonly<Record<string, string>>, plainKey: string, qualifiedKey: string): string | undefined {
  return rev[qualifiedKey] ?? rev[plainKey];
}

export function mappedControls(map: ControlMap): Set<string> {
  return new Set(Object.keys(map));
}

export function exportMap(profile: string, map: ControlMap, device?: string): ControlMapFile {
  return { version: 1, profile, ...(device ? { device } : {}), entries: { ...map } };
}

/**
 * Import a map file. Also accepts the prototype's `djt-map` shape (`{control: "n:0:11"}`)
 * with every entry marked unverified.
 */
export function importMap(input: unknown): { profile: string | null; map: ControlMap } {
  const file = ControlMapFile.safeParse(input);
  if (file.success) return { profile: file.data.profile, map: { ...file.data.entries } };
  const legacy = z.record(z.string(), z.string()).safeParse(input);
  if (legacy.success) {
    const map: ControlMap = {};
    for (const [c, key] of Object.entries(legacy.data)) {
      const e = MapEntry.safeParse({ key, verified: false });
      if (e.success) map[c] = e.data;
    }
    return { profile: null, map };
  }
  throw new Error('Not a control map file');
}
