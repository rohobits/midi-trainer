import type { Drill, Target } from '../drills/schema';
import { mulberry32 } from './random';
import { targetEnd } from '../drills/expand';

/**
 * Sparser variant of a drill: keeps a `density` fraction of press targets (taps, cuts,
 * alternate hits are expanded first) chosen with a seed; continuous targets are kept.
 * Rocksmith-style dynamic difficulty.
 */
export function densityVariant(drill: Drill, density: number, seed: number): Drill {
  const rnd = mulberry32(seed);
  const targets: Target[] = [];
  for (const t of drill.targets) {
    if (t.type === 'alternate') {
      for (let i = 0; i < t.n; i++) if (rnd() < density) targets.push({ type: 'tap', c: t.c, t: t.t + i * t.step });
      continue;
    }
    if ((t.type === 'tap' || t.type === 'cut') && rnd() >= density) continue;
    targets.push(t);
  }
  if (!targets.length) targets.push(drill.targets[0]!);
  const pct = Math.round(density * 100);
  return { ...drill, id: `${drill.id}-d${pct}-s${seed}`, name: `${drill.name} · ${pct}%`, targets, variantOf: drill.id, seed, level: drill.level };
}

export interface TemplateParams {
  bars: number;
  bpm: number;
  seed: number;
  genre?: string;
}

const B = (bar: number) => (bar - 1) * 4;

type Template = (p: TemplateParams) => Pick<Drill, 'name' | 'targets' | 'skills' | 'path' | 'lesson'>;

/** Parametric drill templates for genre presets and generated challenges. */
export const TEMPLATES: Record<string, Template> = {
  faderBlend: (p) => ({
    name: `Fader blend over ${p.bars} bars`,
    path: 'mixer',
    skills: ['fader-blend'],
    targets: [{ type: 'tap', c: 'playB', t: 0 }, { type: 'ramp', c: 'faderB', t: 0, t1: B(p.bars + 1), v0: 0, v1: 1 }, { type: 'ramp', c: 'faderA', t: B(p.bars + 1), t1: B(2 * p.bars + 1), v0: 1, v1: 0 }],
    lesson: `## Blend over ${p.bars} bars\n\nBring B up evenly across ${p.bars} bars from a phrase boundary, then A down over the next ${p.bars}. The hand should move so steadily it looks still.`,
  }),
  bassSwap: (p) => ({
    name: `Bass swap after ${p.bars} bars`,
    path: 'transitions',
    skills: ['bass-swap', 'phrase-mixing'],
    targets: [
      { type: 'tap', c: 'playB', t: 0 },
      { type: 'hold', c: 'lowB', t: 0, t1: B(p.bars + 1), v: 0 },
      { type: 'ramp', c: 'faderB', t: 0, t1: B(p.bars / 2 + 1), v0: 0, v1: 1 },
      { type: 'cross', c: 'lowA', c2: 'lowB', t: B(p.bars + 1), t1: B(p.bars + 2), va0: 0.5, va1: 0, vb0: 0, vb1: 0.5, ceiling: 0.5 },
      { type: 'ramp', c: 'faderA', t: B(p.bars + 5), t1: B(p.bars + 9), v0: 1, v1: 0 },
    ],
    lesson: `## One kick owns the low end\n\nB enters bass-cut over ${p.bars / 2} bars. At bar ${p.bars + 1} swap the bass inside one bar: A's low down as B's low comes to centre. Never both above centre.`,
  }),
  filterOut: (p) => ({
    name: `Filter out over ${p.bars} bars`,
    path: 'transitions',
    skills: ['filter-mix-out'],
    targets: [{ type: 'tap', c: 'playB', t: 0 }, { type: 'ramp', c: 'faderB', t: 0, t1: B(5), v0: 0, v1: 1 }, { type: 'ramp', c: 'filtA', t: B(5), t1: B(5 + p.bars), v0: 0.5, v1: 0.95 }, { type: 'cut', c: 'faderA', t: B(5 + p.bars), v0: 1, v1: 0 }, { type: 'ramp', c: 'filtA', t: B(5 + p.bars), t1: B(6 + p.bars), v0: 0.95, v1: 0.5 }],
    lesson: `## Sweep the old track into the air\n\nHigh-pass A over ${p.bars} bars until only air remains, cut the fader on the phrase, and return the filter to centre so the next track loads clean.`,
  }),
  cueDrumming: (p) => {
    const rnd = mulberry32(p.seed);
    const pads = ['hcA1', 'hcA2', 'hcA3', 'hcA4'];
    const targets: Target[] = [];
    for (let bar = 0; bar < p.bars; bar++) {
      for (let beat = 0; beat < 4; beat++) {
        targets.push({ type: 'tap', c: pads[beat % 2 === 0 ? 0 : 1]!, t: bar * 4 + beat });
        if (rnd() < 0.5) targets.push({ type: 'tap', c: pads[2 + Math.floor(rnd() * 2)]!, t: bar * 4 + beat + 0.5 });
      }
    }
    return { name: `Cue drumming pattern #${p.seed % 1000}`, path: 'pads', skills: ['hot-cue-drumming'], targets, lesson: '## Pads as an instrument\n\nKick on 1 and 3, clap on 2 and 4, hats and stabs on the off-beats the pattern gives you. Sloppy eighths are what make pad play sound amateur.' };
  },
  faderChops: (p) => ({
    name: `Fader chops on ${p.seed % 2 ? '16ths' : '8ths'}`,
    path: 'mixer',
    skills: ['fader-cuts'],
    targets: [{ type: 'alternate', c: 'faderA', t: 0, n: p.bars * (p.seed % 2 ? 16 : 8), step: p.seed % 2 ? 0.25 : 0.5, v0: 1, v1: 0 }],
    lesson: '## Cut the fader like a switch\n\nEvery hit flips the channel fader between full and off on the grid. Telegraph a switch by chopping the last bar of the outgoing track.',
  }),
  loopRoll: (p) => ({
    name: `Loop roll into bar ${p.bars + 1}`,
    path: 'fx',
    skills: ['loop-roll'],
    targets: [{ type: 'step', c: 'loopA', t: B(p.bars - 3), step: 4, count: 4, exitC: 'reloopA', exitAt: B(p.bars + 1) }],
    lesson: '## Halve the loop, double the tension\n\nRe-set the loop every bar for four bars, then exit exactly on the one so the drop lands clean.',
  }),
};

export function generateFromTemplate(template: string, p: TemplateParams, profile = 'flx4'): Drill {
  const t = TEMPLATES[template];
  if (!t) throw new Error(`unknown template ${template}`);
  const body = t(p);
  const bars = Math.max(p.bars, Math.ceil(Math.max(...body.targets.map(targetEnd)) / 4));
  return {
    id: `gen-${template.toLowerCase()}-${p.bars}b-${String(p.bpm).replace('.', '-')}-${p.seed}`,
    version: 1,
    name: body.name,
    tier: 'Generated',
    profile,
    bpm: p.bpm,
    bars,
    targets: body.targets,
    lesson: body.lesson,
    skills: body.skills,
    path: body.path,
    level: 1,
    genre: p.genre ? [p.genre] : undefined,
    variantOf: template,
    seed: p.seed,
  };
}
