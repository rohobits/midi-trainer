import { describe, expect, it } from 'vitest';
import { parseDrill, parseDrillFile, describeIssues, Drill } from '../src/drills/schema';
import { lanesFor, lengthBeats, controlsFor } from '../src/drills/lanes';
import { availability } from '../src/drills/availability';

const base = {
  id: 'phrase-counting',
  name: 'Phrase counting',
  tier: 'Foundations',
  profile: 'flx4',
  bpm: 125,
  bars: 8,
  targets: [{ type: 'tap', c: 'hcA1', t: 0 }, { type: 'ramp', c: 'faderB', t: 0, t1: 4, v0: 0, v1: 1 }],
  lesson: '## Why\n\nBecause.',
};

describe('drill schema', () => {
  it('accepts a valid drill and fills defaults', () => {
    const d = parseDrill(base);
    expect(d.version).toBe(1);
    expect(d.targets).toHaveLength(2);
  });

  it('rejects non-kebab ids, bad ramps, out-of-range values', () => {
    expect(() => parseDrill({ ...base, id: 'Phrase Counting' })).toThrow();
    expect(() => parseDrill({ ...base, targets: [{ type: 'ramp', c: 'x', t: 4, t1: 2, v0: 0, v1: 1 }] })).toThrow();
    expect(() => parseDrill({ ...base, targets: [{ type: 'ramp', c: 'x', t: 0, t1: 2, v0: 0, v1: 1.5 }] })).toThrow();
    expect(() => parseDrill({ ...base, targets: [] })).toThrow();
    expect(() => parseDrill({ ...base, targets: [{ type: 'wiggle', c: 'x', t: 0 }] })).toThrow();
  });

  it('parses a single drill, an array, and a pack', () => {
    expect(parseDrillFile(base)).toHaveLength(1);
    expect(parseDrillFile([base, { ...base, id: 'two' }])).toHaveLength(2);
    expect(parseDrillFile({ version: 1, drills: [base] })).toHaveLength(1);
  });

  it('describes issues with paths', () => {
    const r = Drill.safeParse({ ...base, bpm: 'fast' });
    expect(r.success).toBe(false);
    if (!r.success) expect(describeIssues(r.error)).toMatch(/^bpm:/);
  });

  it('accepts research metadata fields', () => {
    const d = parseDrill({ ...base, skills: ['phrasing'], genre: ['house'], requires: ['decks:3'], sources: ['https://example.com'], needsAudio: true, artist: 'Carl Cox' });
    expect(d.requires).toEqual(['decks:3']);
  });
});

describe('lanes', () => {
  it('orders lanes by first appearance and honours explicit lanes', () => {
    const d = parseDrill(base);
    expect(lanesFor(d)).toEqual(['hcA1', 'faderB']);
    expect(lanesFor({ ...d, lanes: ['faderB', 'hcA1'] })).toEqual(['faderB', 'hcA1']);
    expect(controlsFor(d).sort()).toEqual(['faderB', 'hcA1']);
  });

  it('length is bars × beats, or the last target if longer', () => {
    const d = parseDrill(base);
    expect(lengthBeats(d)).toBe(32);
    expect(lengthBeats({ ...d, bars: 1 })).toBe(4);
    expect(lengthBeats({ ...d, bars: 1, targets: [{ type: 'tap', c: 'x', t: 9 }] })).toBe(9);
  });
});

describe('availability', () => {
  it('reports unmapped controls, audio and hardware needs', () => {
    const d = parseDrill({ ...base, needsAudio: true, requires: ['decks:4'] });
    const a = availability(d, new Set(['hcA1']), { capabilities: new Set(['decks:2']) });
    expect(a.available).toBe(false);
    expect(a.reasons).toEqual([
      { kind: 'unmapped', controls: ['faderB'] },
      { kind: 'needsAudio' },
      { kind: 'requires', hardware: ['decks:4'] },
    ]);
    expect(availability(parseDrill(base), new Set(['hcA1', 'faderB'])).available).toBe(true);
  });
});
