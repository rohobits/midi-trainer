import { z } from 'zod';

/**
 * Drill schema. Times (`t`, `t1`, `d`) are in beats from the drill start; 4/4 unless
 * `timeSig` says otherwise. Values (`v`, `v0`, `v1`) are normalised 0..1 (CC / 127).
 * Control ids (`c`) refer to a profile's control list, not MIDI numbers.
 */

const beat = z.number().finite();
const unit = z.number().min(0).max(1);

export const TapTarget = z.object({
  type: z.literal('tap'),
  c: z.string().min(1),
  t: beat,
});

export const RampTarget = z
  .object({
    type: z.literal('ramp'),
    c: z.string().min(1),
    t: beat,
    t1: beat,
    v0: unit,
    v1: unit,
  })
  .refine((r) => r.t1 > r.t, { message: 't1 must be after t' });

export const HoldTarget = z
  .object({
    type: z.literal('hold'),
    c: z.string().min(1),
    t: beat,
    t1: beat,
    v: unit,
  })
  .refine((r) => r.t1 > r.t, { message: 't1 must be after t' });

export const NoteTarget = z.object({
  type: z.literal('note'),
  n: z.number().int().min(0).max(127),
  t: beat,
  d: z.number().positive(),
  hand: z.enum(['L', 'R']).optional(),
});

export const Target = z.discriminatedUnion('type', [TapTarget, RampTarget, HoldTarget, NoteTarget]);

export const ScoringThresholds = z.object({
  /** Half-width of the tap acceptance window, in beats. */
  tapWindowBeats: z.number().positive(),
  /** Tap score decays linearly to 0 at this absolute error in ms. */
  tapZeroMs: z.number().positive(),
  /** A ramp is a hit if its mean absolute tracking error is below this (0..1 scale). */
  rampHit: z.number().positive(),
  /** Ramp score decays linearly to 0 at this mean error. */
  rampZero: z.number().positive(),
  /** Half-width of the play-along note window, in beats. */
  noteWindowBeats: z.number().positive(),
  /** Judgement tier windows in ms (absolute error). Scaled by the strictness setting. */
  tierPerfectMs: z.number().positive(),
  tierGreatMs: z.number().positive(),
  tierOkMs: z.number().positive(),
});

export const Drill = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'id must be kebab-case'),
  version: z.literal(1).default(1),
  name: z.string().min(1),
  tier: z.string().min(1),
  profile: z.string().min(1),
  bpm: z.number().min(20).max(400),
  bars: z.number().int().positive(),
  timeSig: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
  /** Explicit lane order. Default: order of first appearance in `targets`. */
  lanes: z.array(z.string()).optional(),
  targets: z.array(Target).min(1),
  /** Markdown. The "why". */
  lesson: z.string(),
  thresholds: ScoringThresholds.partial().optional(),
  /** Drill ids that should be passed first. */
  prereqs: z.array(z.string()).optional(),
  /** Score needed to pass. Default 80 (bronze). */
  passScore: z.number().min(0).max(100).optional(),
  skills: z.array(z.string()).optional(),
  genre: z.array(z.string()).optional(),
  /** Hardware this drill needs that the target profile may lack. */
  requires: z.array(z.string()).optional(),
  /** URLs the technique is drawn from. */
  sources: z.array(z.string().url()).optional(),
  /** Only when a source describes the technique as this artist's. */
  artist: z.string().optional(),
  /** Drill only makes sense once the in-app audio engine exists. */
  needsAudio: z.boolean().optional(),
  path: z.string().optional(),
  level: z.number().int().positive().optional(),
});

export const DrillPack = z.object({
  version: z.literal(1),
  name: z.string().optional(),
  drills: z.array(Drill).min(1),
});

export type TapTarget = z.infer<typeof TapTarget>;
export type RampTarget = z.infer<typeof RampTarget>;
export type HoldTarget = z.infer<typeof HoldTarget>;
export type NoteTarget = z.infer<typeof NoteTarget>;
export type Target = z.infer<typeof Target>;
export type ScoringThresholds = z.infer<typeof ScoringThresholds>;
export type Drill = z.infer<typeof Drill>;
export type DrillPack = z.infer<typeof DrillPack>;

/** Parse one drill; throws a ZodError with a readable path on failure. */
export function parseDrill(input: unknown): Drill {
  return Drill.parse(input);
}

/**
 * Parse a drill file: a single drill, an array of drills, or a `{version:1, drills}` pack.
 * Returns the drills in file order.
 */
export function parseDrillFile(input: unknown): Drill[] {
  if (Array.isArray(input)) return input.map((d) => Drill.parse(d));
  if (input && typeof input === 'object' && 'drills' in input) return DrillPack.parse(input).drills;
  return [Drill.parse(input)];
}

/** Human-readable summary of a Zod failure, for the loader UI. */
export function describeIssues(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
}

/** Message for any load failure: Zod issues with paths, otherwise the error text. */
export function formatDrillError(e: unknown): string {
  if (e instanceof z.ZodError) return describeIssues(e);
  return e instanceof Error ? e.message : String(e);
}
