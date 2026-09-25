import { describe, expect, it } from 'vitest';
import { DrillRun } from '../src/session/run';
import { NoteRun } from '../src/session/noteRun';
import { PerfState } from '../src/session/perf';
import { DEFAULT_THRESHOLDS } from '../src/scoring/thresholds';
import { parseDrill } from '../src/drills/schema';
import type { TapState } from '../src/scoring/judges/state';

const T = DEFAULT_THRESHOLDS;

const drill = parseDrill({
  id: 'r2', name: 'r2', tier: 'T', profile: 'flx4', bpm: 120, bars: 2, lesson: '',
  targets: [
    { type: 'tap', c: 'hcA1', t: 0 },
    { type: 'tap', c: 'hcA1', t: 2 },
    { type: 'cut', c: 'xf', t: 4, v0: 0, v1: 1 },
    { type: 'jog', c: 'jogA', t: 4, t1: 6, pattern: ['f'] },
    { type: 'select', c: 'chSelect1', choices: ['chSelect1', 'chSelect2'], t: 0, t1: 3 },
  ],
});
const kinds = { hcA1: 'tap', xf: 'cc', jogA: 'rel', chSelect1: 'tap', chSelect2: 'tap' } as const;

describe('DrillRun v2', () => {
  it('routes presses to select first, values to cuts, deltas to jogs', () => {
    const run = new DrillRun(drill, { thresholds: T, kinds });
    expect(run.lanes).toEqual(['hcA1', 'xf', 'jogA', 'chSelect1', 'chSelect2']);
    run.start(0);
    expect(run.onTap('chSelect2', 100).target?.kind).toBe('select');
    expect(run.extraPresses).toBe(0);
    run.onTap('hcA1', 10);
    run.onValue('xf', 0, 1000, );
    run.onValue('xf', 0.6, 1960);
    run.onValue('xf', 1, 2005); // beat 4.01
    run.onRel('jogA', 4, 2200);
    run.tick(3100); // past jog end (beat 6.2)
    const st = run.stats();
    expect(st.completed).toBe(5); // select, tap0, tap1 missed, cut, jog
    expect(st.sub.technique).toBe(50); // select wrong (0) + jog right (1)
    expect(st.tiers.perfect).toBe(2); // tap 10 ms + cut 5 ms
  });

  it('wait mode freezes on the next press target until it is pressed', () => {
    const run = new DrillRun(drill, { thresholds: T, kinds, waitMode: true });
    run.start(0);
    let r = run.tick(50);
    expect(r.waiting).toBe(true);
    expect(run.pos(500)).toBe(0);
    const j = run.onTap('hcA1', 900);
    expect((j.target as TapState).tier).toBe('perfect');
    expect(run.waiting).toBe(false);
    expect(run.pos(1400)).toBeCloseTo(1);
    r = run.tick(1900); // reaches beat 2 target → freeze again
    expect(r.waiting).toBe(true);
    expect(run.pos(3000)).toBe(2);
  });

  it('section loop repeats bars and tempo scale slows the clock', () => {
    const run = new DrillRun(drill, { thresholds: T, kinds, section: [1, 1], tempoScale: 0.5 });
    expect(run.bpm).toBe(60);
    run.start(0);
    expect(run.pos(1000)).toBe(1);
    const r = run.tick(4000); // beat 4 = end of bar 1 → loop
    expect(r.looped).toBe(true);
    expect(run.pos(4000)).toBe(0);
  });

  it('lane isolation skips other lanes without scoring them', () => {
    const run = new DrillRun(drill, { thresholds: T, kinds, onlyLanes: ['hcA1'] });
    run.start(0);
    run.tick(5000);
    const st = run.stats();
    expect(st.total).toBe(2);
    expect(st.completed).toBe(2);
  });

  it('performance mode tracks combo, multiplier and points', () => {
    const p = new PerfState({ phraseBeats: 4 });
    for (let i = 0; i < 25; i++) p.settle(1, i * 0.1);
    expect(p.combo).toBe(25);
    expect(p.multiplier).toBe(3);
    p.settle(0, 2.6);
    expect(p.combo).toBe(0);
    expect(p.multiplier).toBe(1);
    expect(p.points).toBe(9 * 100 + 10 * 200 + 6 * 300); // combos 1–9 at 1×, 10–19 at 2×, 20–25 at 3×
    p.tick(4.5); // phrase 0 was not clean (one miss) → no charge
    expect(p.euphoriaCharge).toBe(0);
    for (let i = 0; i < 12; i++) p.settle(1, 4.5 + i * 0.1);
    p.tick(8.5);
    expect(p.euphoriaCharge).toBe(1);
    expect(p.activateEuphoria(8.5)).toBe(true);
    expect(p.multiplier).toBe(4);
    p.tick(13);
    expect(p.multiplier).toBe(2);
    expect(p.stars).toBeGreaterThanOrEqual(1);
    const run = new DrillRun(drill, { thresholds: T, kinds, mode: 'performance' });
    run.start(0);
    run.onTap('hcA1', 0);
    expect(run.perf?.points).toBe(100);
    expect(run.attempt('flx4').perf?.points).toBe(100);
  });
});

const piano = parseDrill({
  id: 'p', name: 'p', tier: 'Week 1', profile: 'piano88', bpm: 60, bars: 1, lesson: '',
  targets: [
    { type: 'note', n: 60, t: 0, d: 1, hand: 'R' },
    { type: 'note', n: 64, t: 0, d: 1, hand: 'R' },
    { type: 'note', n: 48, t: 1, d: 1, hand: 'L' },
  ],
});

describe('NoteRun', () => {
  it('wait mode freezes on the chord, releases when both notes are played, then freezes on the next', () => {
    const run = new NoteRun(piano, { thresholds: T, mode: 'wait', hand: 'B' });
    run.start(0);
    let r = run.tick(10);
    expect(r.waiting).toBe(true);
    expect(run.pos(500)).toBe(0);
    expect(run.noteOn(62, 100).target).toBeNull();
    expect(run.wrong).toBe(1);
    expect(run.noteOn(60, 200).target?.n).toBe(60);
    r = run.tick(300);
    expect(r.waiting).toBe(true);
    run.noteOn(64, 400);
    r = run.tick(410);
    expect(r.waiting).toBe(false);
    expect(run.pos(1410)).toBeCloseTo(1, 1);
    r = run.tick(1500);
    expect(r.waiting).toBe(true);
    expect(run.nextDue(run.pos(1500)).map((n) => n.n)).toEqual([48]);
    expect(run.accuracy()).toBe(67);
  });

  it('play-along marks misses and finishes with an attempt record', () => {
    const run = new NoteRun(piano, { thresholds: T, mode: 'play', hand: 'R' });
    run.start(0);
    run.noteOn(60, 50);
    run.tick(1500); // 64 missed (window 0.3 beat = 300 ms)
    expect(run.missed).toBe(1);
    const r = run.tick(6000);
    expect(r.ended).toBe(true);
    const a = run.attempt();
    expect(a.notes).toEqual({ correct: 1, wrong: 0, missed: 1, mode: 'play', hand: 'R' });
    expect(a.score).toBe(50);
    expect(a.timingMeanMs).toBe(50);
  });

  it('guide events fire once per note crossing', () => {
    const run = new NoteRun(piano, { thresholds: T, mode: 'play', hand: 'B' });
    run.start(0);
    const g1 = run.tick(100).guide.map((n) => n.n);
    expect(g1).toEqual([60, 64]);
    expect(run.tick(150).guide).toEqual([]);
    expect(run.tick(1100).guide.map((n) => n.n)).toEqual([48]);
  });
});
