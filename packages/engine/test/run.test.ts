import { describe, expect, it } from 'vitest';
import { DrillRun } from '../src/session/run';
import { DEFAULT_THRESHOLDS } from '../src/scoring/thresholds';
import { parseDrill } from '../src/drills/schema';
import type { TapState } from '../src/scoring/judges/state';

const drill = parseDrill({
  id: 'run-test',
  name: 'Run test',
  tier: 'Test',
  profile: 'flx4',
  bpm: 120, // 500 ms per beat
  bars: 1,
  targets: [
    { type: 'tap', c: 'hcA1', t: 0 },
    { type: 'tap', c: 'hcA1', t: 2 },
    { type: 'ramp', c: 'faderB', t: 0, t1: 2, v0: 0, v1: 1 },
  ],
  lesson: '',
});

describe('DrillRun', () => {
  it('runs a drill end to end with the prototype flow', () => {
    const run = new DrillRun(drill, { thresholds: DEFAULT_THRESHOLDS, inputOffsetMs: 0 });
    expect(run.lanes).toEqual(['hcA1', 'faderB']);
    expect(run.length).toBe(4);
    run.start(1000);
    expect(run.phase).toBe('running');
    // press 20 ms late on beat 0
    const j = run.onTap('hcA1', 1020);
    expect((j.target as TapState).errMs).toBeCloseTo(20);
    expect((j.target as TapState).tier).toBe('perfect');
    // ride the fader: perfect tracking sampled every 50 ms
    for (let t = 1000; t <= 2000; t += 50) {
      run.onValue('faderB', (t - 1000) / 1000, t);
      run.tick(t);
    }
    // extra press at beat 1 (no target within 0.35 beat)
    expect(run.onTap('hcA1', 1500).extra).toBe(true);
    expect(run.extraPresses).toBe(1);
    // miss beat 2 entirely
    let r = run.tick(2200);
    expect(r.missed).toEqual([1]);
    expect(r.finished).toEqual([2]);
    const st = run.stats();
    expect(st.completed).toBe(3);
    expect(st.tiers).toEqual({ perfect: 1, great: 0, ok: 0, miss: 1 });
    // ends at length + 2 beats = 6 beats = 3000 ms after start
    r = run.tick(3999);
    expect(r.ended).toBe(false);
    r = run.tick(4000);
    expect(r.ended).toBe(true);
    expect(run.phase).toBe('finished');
    const a = run.attempt('flx4');
    expect(a.drillId).toBe('run-test');
    expect(a.score).toBe(Math.round((100 * (1 - 20 / 150 + 0 + 1)) / 3));
    expect(a.medal).toBeNull();
    expect(a.inputLog.length).toBeGreaterThan(20);
    expect(a.perTarget[1]).toEqual({ id: 1, hit: false, err: null });
  });

  it('applies the input offset, counts in, loops, and cues the next target', () => {
    const run = new DrillRun(drill, { thresholds: DEFAULT_THRESHOLDS, inputOffsetMs: 20, countInBars: 1, loop: true });
    run.start(0);
    expect(run.phase).toBe('countin');
    expect(run.pos(0)).toBe(-4);
    run.tick(2000);
    expect(run.phase).toBe('running');
    expect(run.cue(-1, { hcA1: 'Hot cue A1' })).toEqual({ text: 'Tap Hot cue A1 in 1 beats', beatsAway: 1 });
    // event stamped 2020 with a 20 ms offset is judged at beat 0 exactly
    expect((run.onTap('hcA1', 2020).target as TapState).errMs).toBeCloseTo(0);
    const r = run.tick(2000 + 3000);
    expect(r.looped).toBe(true);
    expect(run.pos(5000)).toBe(0);
    expect(run.states.every((s) => !s.hit && !s.miss)).toBe(true);
  });

  it('presses while stopped flash but are not judged; bpm can change mid-run', () => {
    const run = new DrillRun(drill, { thresholds: DEFAULT_THRESHOLDS });
    expect(run.onTap('hcA1', 5).target).toBeNull();
    expect(run.extraPresses).toBe(0);
    run.start(0);
    run.setBpm(60, 500); // at beat 1
    expect(run.pos(1500)).toBe(2);
    expect((run.onTap('hcA1', 1500).target as TapState).errMs).toBeCloseTo(0);
  });
});
