import type { Drill } from '../drills/schema';
import { hashString, mulberry32, dayKey } from './random';
import { densityVariant, generateFromTemplate, TEMPLATES } from './generate';

export interface DailyChallenge {
  day: string;
  seed: number;
  drill: Drill;
  /** What was varied, for the card. */
  twist: string;
}

/**
 * One drill per day, the same for everyone: seeded from the date. Either a built-in drill
 * with a tempo/density twist or a generated template. Runs are stored under the drill's
 * generated id so history and leaderboards (later) key on the day.
 */
export function dailyChallenge(drills: readonly Drill[], day = dayKey()): DailyChallenge {
  const seed = hashString(`daily:${day}`);
  const rnd = mulberry32(seed);
  const pool = drills.filter((d) => d.profile === 'flx4' && !d.needsAudio && !(d.requires?.length));
  const useTemplate = rnd() < 0.4 || pool.length === 0;
  if (useTemplate) {
    const names = Object.keys(TEMPLATES);
    const template = names[Math.floor(rnd() * names.length)]!;
    const bars = [4, 8, 8, 16][Math.floor(rnd() * 4)]!;
    const bpm = [122, 124, 125, 126, 128][Math.floor(rnd() * 5)]!;
    const drill = generateFromTemplate(template, { bars, bpm, seed });
    return { day, seed, drill: { ...drill, id: `daily-${day}`, name: `Daily · ${drill.name}`, tier: 'Daily' }, twist: `${template} · ${bars} bars · ${bpm} BPM` };
  }
  const base = pool[Math.floor(rnd() * pool.length)]!;
  const density = [1, 1, 0.75, 0.5][Math.floor(rnd() * 4)]!;
  const bpmShift = Math.round((rnd() * 10 - 5) * 10) / 10;
  const variant = density < 1 ? densityVariant(base, density, seed) : base;
  const bpm = Math.round((base.bpm + bpmShift) * 10) / 10;
  return {
    day,
    seed,
    drill: { ...variant, id: `daily-${day}`, name: `Daily · ${base.name}`, tier: 'Daily', bpm },
    twist: `${density < 1 ? `${Math.round(density * 100)}% density · ` : ''}${bpm} BPM`,
  };
}
