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

/** Near-instant traverse from v0 to v1 landing on beat t (crossfader drop mix, fader kill). */
export const CutTarget = z.object({
  type: z.literal('cut'),
  c: z.string().min(1),
  t: beat,
  v0: unit,
  v1: unit,
  /** Traverse must complete within this many ms for full credit. Default 120. */
  maxMs: z.number().positive().optional(),
});

/** Two mirrored ramps on two controls that must never both exceed `ceiling` (bass swap). */
export const CrossTarget = z
  .object({
    type: z.literal('cross'),
    c: z.string().min(1),
    c2: z.string().min(1),
    t: beat,
    t1: beat,
    va0: unit,
    va1: unit,
    vb0: unit,
    vb1: unit,
    /** Both controls above this at the same sample is a violation. Default 0.5. */
    ceiling: unit.optional(),
  })
  .refine((r) => r.t1 > r.t, { message: 't1 must be after t' })
  .refine((r) => r.c !== r.c2, { message: 'cross needs two different controls' });

/** n hits on a subdivision grid (fader chops, transformer, cue drumming). Expands to taps or cuts. */
export const AlternateTarget = z.object({
  type: z.literal('alternate'),
  c: z.string().min(1),
  t: beat,
  n: z.number().int().min(2).max(512),
  step: z.number().positive(),
  /** For continuous controls: the two values alternated between. Default 0 and 1. */
  v0: unit.optional(),
  v1: unit.optional(),
});

/** Presses at regular intervals then an exit press on the one (loop roll, beat roll build). Expands to taps. */
export const StepTarget = z.object({
  type: z.literal('step'),
  c: z.string().min(1),
  t: beat,
  step: z.number().positive(),
  count: z.number().int().min(1).max(64),
  /** Control to press at `exitAt` (default: same control). */
  exitC: z.string().min(1).optional(),
  exitAt: beat.optional(),
});

/** Jog movement pattern: one direction per segment of `seg` beats between t and t1. */
export const JogTarget = z
  .object({
    type: z.literal('jog'),
    c: z.string().min(1),
    t: beat,
    t1: beat,
    pattern: z.array(z.enum(['f', 'b'])).min(1),
    /** Minimum encoder ticks per segment to count. Default 3. */
    minTicks: z.number().int().positive().optional(),
  })
  .refine((r) => r.t1 > r.t, { message: 't1 must be after t' });

/** Press the right control among `choices` between t and t1 (CH SELECT, key choice, curve). */
export const SelectTarget = z
  .object({
    type: z.literal('select'),
    c: z.string().min(1),
    choices: z.array(z.string().min(1)).min(2),
    t: beat,
    t1: beat,
  })
  .refine((r) => r.t1 > r.t, { message: 't1 must be after t' })
  .refine((r) => r.choices.includes(r.c), { message: 'c must be one of choices' });

export const PrimitiveTarget = z.discriminatedUnion('type', [
  TapTarget, RampTarget, HoldTarget, NoteTarget, CutTarget, CrossTarget, JogTarget, SelectTarget,
]);

/** Ordered chain of primitives with times relative to `t` (echo out, drop swap, routines). */
export const SequenceTarget = z.object({
  type: z.literal('sequence'),
  t: beat,
  steps: z.array(PrimitiveTarget).min(2),
});

export const Target = z.discriminatedUnion('type', [
  TapTarget, RampTarget, HoldTarget, NoteTarget, CutTarget, CrossTarget, AlternateTarget, StepTarget,
  JogTarget, SelectTarget, SequenceTarget,
]);

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
  /** Generated variants record their template and seed. */
  variantOf: z.string().optional(),
  seed: z.number().int().optional(),
  /** Loop range for the section-loop tool, in bars (1-based, inclusive). */
  section: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
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
export type CutTarget = z.infer<typeof CutTarget>;
export type CrossTarget = z.infer<typeof CrossTarget>;
export type AlternateTarget = z.infer<typeof AlternateTarget>;
export type StepTarget = z.infer<typeof StepTarget>;
export type JogTarget = z.infer<typeof JogTarget>;
export type SelectTarget = z.infer<typeof SelectTarget>;
export type SequenceTarget = z.infer<typeof SequenceTarget>;
export type PrimitiveTarget = z.infer<typeof PrimitiveTarget>;
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
