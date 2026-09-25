import { describe, expect, it } from 'vitest';
import { makePatterns, makeSections, makeTrack, camelot, camelotCompatible, sectionAt, LOOP_STEPS, genreBpm } from '../src/audio/patterns';
import { Crowd } from '../src/audio/crowd';

describe('patterns', () => {
  it('house is four on the floor with claps on 2 and 4; deterministic from the seed', () => {
    const p = makePatterns({ seed: 5, root: 0, minor: true, genre: 'house' });
    expect(p.kick.length).toBe(LOOP_STEPS);
    for (let s = 0; s < LOOP_STEPS; s++) expect(p.kick[s]).toBe(s % 4 === 0);
    expect(p.clap[4]).toBe(true);
    expect(p.clap[12]).toBe(true);
    expect(p.clap[0]).toBe(false);
    expect(makePatterns({ seed: 5, root: 0, minor: true, genre: 'house' })).toEqual(p);
    expect(p.chords).toHaveLength(4);
    expect(p.bass.some((n) => n != null)).toBe(true);
  });
  it('drum and bass and half-time genres place kicks differently', () => {
    const d = makePatterns({ seed: 1, root: 2, minor: true, genre: 'drum-and-bass' });
    expect(d.kick[0]).toBe(true);
    expect(d.kick[4]).toBe(false);
    expect(d.kick[10]).toBe(true);
    const h = makePatterns({ seed: 1, root: 2, minor: true, genre: 'dubstep' });
    expect(h.clap[8]).toBe(true);
    expect(h.clap[4]).toBe(false);
  });
  it('sections cover the track and the arrangement starts with an intro and ends with an outro', () => {
    const secs = makeSections(128, 'house');
    expect(secs[0]!.kind).toBe('intro');
    expect(secs[secs.length - 1]!.kind).toBe('outro');
    expect(secs.reduce((a, s) => a + s.bars, 0)).toBe(128);
    const t = makeTrack(42, 'techno', 64);
    expect(t.sections.reduce((a, s) => a + s.bars, 0)).toBe(64);
    expect(sectionAt(t, 0)?.kind).toBe('intro');
    expect(sectionAt(t, 999)).toBeNull();
    expect(genreBpm('techno', 1)).toBeGreaterThanOrEqual(128);
    expect(makeTrack(7).id).toBe(makeTrack(7).id);
  });
  it('camelot codes and compatibility', () => {
    expect(camelot(9, true)).toBe('8A'); // A minor
    expect(camelot(0, false)).toBe('8B'); // C major
    expect(camelot(7, false)).toBe('9B'); // G major
    expect(camelotCompatible('8A', '9A')).toBe(true);
    expect(camelotCompatible('8A', '8B')).toBe(true);
    expect(camelotCompatible('8A', '10A')).toBe(false);
    expect(camelotCompatible('12A', '1A')).toBe(true);
  });
});

describe('crowd', () => {
  it('rewards on-grid moves, punishes off-grid, decays when stale, fulfils requests', () => {
    const c = new Crowd();
    expect(c.event({ kind: 'transition', beat: 32 }).delta).toBeCloseTo(0.12);
    expect(c.event({ kind: 'transition', beat: 36.1 }).delta).toBeCloseTo(0.05);
    expect(c.event({ kind: 'transition', beat: 38 }).delta).toBeCloseTo(-0.06);
    const before = c.meter;
    c.tick(40, 4);
    expect(c.meter).toBeLessThan(before);
    c.request('Bring the bass in', 40, 8, (ev) => ev.kind === 'stem' && ev.stem === 'bass' && ev.on);
    expect(c.open).toHaveLength(1);
    const r = c.event({ kind: 'stem', deck: 'B', stem: 'bass', on: true, beat: 64 });
    expect(r.delta).toBeCloseTo(0.27);
    expect(c.open).toHaveLength(0);
    const res = c.result();
    expect(res.moves).toBe(4);
    expect(res.onGrid).toBe(3);
    expect(res.stars).toBeGreaterThanOrEqual(1);
  });
});
