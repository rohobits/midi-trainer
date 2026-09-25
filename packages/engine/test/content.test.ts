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
  it('has the 13 DJ drills and 5 piano exercises from the prototypes', () => {
    expect(drills.filter((d) => d.profile === 'flx4')).toHaveLength(13);
    expect(drills.filter((d) => d.profile === 'piano88')).toHaveLength(5);
  });

  it('ids are unique and match file names', () => {
    const ids = drills.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    files.forEach((f, i) => expect(path.basename(f, '.json')).toMatch(new RegExp(`${drills[i]!.id}$`)));
  });

  it('every DJ control exists on both the FLX4 and generic profiles', () => {
    const flx4 = new Set(FLX4_CONTROLS.map((c) => c.id));
    const generic = new Set(GENERIC_CONTROLS.map((c) => c.id));
    for (const d of drills.filter((d) => d.profile === 'flx4')) {
      for (const c of controlsFor(d)) {
        expect(flx4.has(c), `${d.id} uses ${c} which the FLX4 profile lacks`).toBe(true);
        expect(generic.has(c), `${d.id} uses ${c} which the generic profile lacks`).toBe(true);
      }
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
