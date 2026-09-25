import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDrill, type Drill } from '../src/drills/schema';
import { controlsFor } from '../src/drills/lanes';
import { FLX4_CONTROLS } from '../src/profiles/flx4/controls';
import { GENERIC_CONTROLS } from '../src/profiles/generic/controls';

const root = fileURLToPath(new URL('../../../content/drills', import.meta.url));

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e: fs.Dirent) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.json') ? [p] : [];
  });
}

const files = walk(root).sort();
const drills: Drill[] = files.map((f) => parseDrill(JSON.parse(fs.readFileSync(f, 'utf8'))));

describe('content/drills', () => {
  it('still has the 13 DJ drills and 5 piano exercises from the prototypes', () => {
    const ids = new Set(drills.map((d) => d.id));
    for (const id of ['phrase-counting', 'fader-control', 'classic-bass-swap-transition', 'staggered-eq-blend', 'filter-out-transition', 'hard-cut-on-the-one', 'hot-cue-drumming', 'loop-build-and-release', 'cue-point-stutter', 'double-drop', 'two-bar-eq-swap', 'crossfader-cut-pattern', 'manual-beatmatch-nudge', 'c-major-scale-right-hand', 'ode-to-joy-first-8-bars']) expect(ids.has(id), id).toBe(true);
    expect(drills.filter((d) => d.profile === 'flx4').length).toBeGreaterThanOrEqual(13);
    expect(drills.filter((d) => d.profile === 'piano88').length).toBeGreaterThanOrEqual(5);
  });

  it('research metadata is well formed: sources are URLs, artists only with sources, requires are known tokens', () => {
    const known = new Set(['decks:3', 'decks:4', 'beatfx:2', 'motorised-platter', 'turntable', 'stems-pads', 'split-cue', 'eq:4', 'isolator', 'sampler:external', 'mic-fx', 'mixer-roll']);
    for (const d of drills) {
      if (d.artist) expect(d.sources?.length, `${d.id} names an artist without sources`).toBeGreaterThan(0);
      for (const r of d.requires ?? []) expect(known.has(r), `${d.id} requires unknown hardware token ${r}`).toBe(true);
      if (d.profile === 'flx4') {
        expect(d.path, `${d.id} has no path`).toBeTruthy();
        expect(d.level, `${d.id} has no level`).toBeTruthy();
        expect(d.skills?.length, `${d.id} has no skills`).toBeGreaterThan(0);
      }
    }
  });

  it('ids are unique and match file names', () => {
    const ids = drills.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    files.forEach((f, i) => expect(path.basename(f, '.json')).toMatch(new RegExp(`${drills[i]!.id}$`)));
  });

  it('every DJ control exists on the FLX4 profile; prototype drills also run on the generic profile', () => {
    const flx4 = new Set(FLX4_CONTROLS.map((c) => c.id));
    const generic = new Set(GENERIC_CONTROLS.map((c) => c.id));
    for (const d of drills.filter((d) => d.profile === 'flx4')) {
      for (const c of controlsFor(d)) expect(flx4.has(c), `${d.id} uses ${c} which the FLX4 profile lacks`).toBe(true);
    }
    for (const id of ['phrase-counting', 'classic-bass-swap-transition', 'hot-cue-drumming']) {
      const d = drills.find((x) => x.id === id)!;
      for (const c of controlsFor(d)) expect(generic.has(c), `${d.id} uses ${c} which the generic profile lacks`).toBe(true);
    }
  });

  it('every drill has a lesson with a heading, and piano targets carry hands', () => {
    for (const d of drills) {
      expect(d.lesson, d.id).toMatch(/^## /);
      if (d.profile === 'piano88') for (const t of d.targets) expect(t.type === 'note' && t.hand).toBeTruthy();
    }
  });

  it('spot-checks migrated numbers against the prototype', () => {
    const swap = drills.find((d) => d.id === 'classic-bass-swap-transition')!;
    expect(swap.targets[3]).toEqual({ type: 'ramp', c: 'lowA', t: 64, t1: 80, v0: 0.5, v1: 0 });
    const drum = drills.find((d) => d.id === 'hot-cue-drumming')!;
    expect(drum.targets).toHaveLength(40);
    expect(drum.targets[3]).toEqual({ type: 'tap', c: 'hcA1', t: 2.5 });
    const ode = drills.find((d) => d.id === 'ode-to-joy-first-8-bars')!;
    expect(ode.bpm).toBe(80);
    expect(ode.targets.filter((t) => t.type === 'note' && t.hand === 'R')).toHaveLength(30);
  });
});
