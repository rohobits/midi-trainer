import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../src/scoring/thresholds';
import { statesFor, type CutState, type CrossState, type JogState, type SelectState, type TapState } from '../src/scoring/judges/state';
import { judgeCutValue, expireCuts, cutScore } from '../src/scoring/judges/cut';
import { sampleCrosses, finishCrosses, crossScore } from '../src/scoring/judges/cross';
import { judgeJogDelta, finishJogs } from '../src/scoring/judges/jog';
import { judgeSelectPress, expireSelects } from '../src/scoring/judges/select';
import { expandTargets, targetControls, targetEnd } from '../src/drills/expand';
import { computeStats, orderViolations } from '../src/scoring/score';
import { judgeTap } from '../src/scoring/judges/tap';
import { parseDrill } from '../src/drills/schema';

const T = DEFAULT_THRESHOLDS;
const BPM = 120; // 500 ms/beat

describe('cut judge', () => {
  it('lands when the value reaches the end zone inside the window; traverse timed from leaving the start zone', () => {
    const states = statesFor({ targets: [{ type: 'cut', c: 'xf', t: 4, v0: 0, v1: 1, maxMs: 100 }] });
    // resting at 0 well before the beat
    expect(judgeCutValue(states, 'xf', 0, 2, 1000, BPM, T)).toBeNull();
    // leave start zone at 1950 ms (beat 3.9), land at 2010 ms (beat 4.02)
    expect(judgeCutValue(states, 'xf', 0.5, 3.9, 1950, BPM, T)).toBeNull();
    const landed = judgeCutValue(states, 'xf', 0.95, 4.02, 2010, BPM, T) as CutState;
    expect(landed.hit).toBe(true);
    expect(landed.errMs).toBeCloseTo(10);
    expect(landed.traverseMs).toBe(60);
    expect(landed.tier).toBe('perfect');
    expect(cutScore(landed, T)).toBeCloseTo(1 - 10 / 150);
  });

  it('slow traverses lose credit; landing outside the window misses', () => {
    expect(cutScore({ errMs: 0, traverseMs: 150, maxMs: 100 }, T)).toBeCloseTo(0.5);
    expect(cutScore({ errMs: 0, traverseMs: 200, maxMs: 100 }, T)).toBe(0);
    const states = statesFor({ targets: [{ type: 'cut', c: 'xf', t: 4, v0: 0, v1: 1 }] });
    expect(judgeCutValue(states, 'xf', 1, 3, 1500, BPM, T)).toBeNull(); // too early, not in window
    expect(expireCuts(states, 4.4, T)).toEqual([0]);
    expect((states[0] as CutState).miss).toBe(true);
  });
});

describe('cross judge', () => {
  it('scores mirrored ramps and penalises both-above-ceiling samples', () => {
    const mk = () => statesFor({ targets: [{ type: 'cross', c: 'lowA', c2: 'lowB', t: 0, t1: 4, va0: 0.5, va1: 0, vb0: 0, vb1: 0.5, ceiling: 0.5 }] });
    let s = mk();
    for (let p = 0; p <= 4; p += 0.5) sampleCrosses(s, p, { lowA: 0.5 - p / 8, lowB: p / 8 });
    finishCrosses(s, 4.1, T);
    let c = s[0] as CrossState;
    expect(c.hit).toBe(true);
    expect(c.err).toBeCloseTo(0);
    expect(c.violationFrac).toBe(0);
    expect(crossScore(c, T)).toBe(1);
    // both bass full the whole time: tracking bad and every sample violates
    s = mk();
    for (let p = 0; p <= 4; p += 0.5) sampleCrosses(s, p, { lowA: 0.9, lowB: 0.9 });
    finishCrosses(s, 4.1, T);
    c = s[0] as CrossState;
    expect(c.hit).toBe(false);
    expect(c.violationFrac).toBe(1);
    expect(crossScore(c, T)).toBe(0);
  });
});

describe('jog judge', () => {
  it('needs the right sign with enough ticks in each segment', () => {
    const s = statesFor({ targets: [{ type: 'jog', c: 'jogA', t: 0, t1: 2, pattern: ['f', 'b'], minTicks: 3 }] });
    judgeJogDelta(s, 'jogA', 2, 0.2);
    judgeJogDelta(s, 'jogA', 2, 0.4);
    judgeJogDelta(s, 'jogA', -1, 1.2); // too few ticks back
    judgeJogDelta(s, 'jogA', 5, 3); // outside window, ignored
    expect(finishJogs(s, 2.1)).toEqual([0]);
    const j = s[0] as JogState;
    expect(j.acc).toEqual([4, -1]);
    expect(j.correct).toBe(0.5);
    expect(j.hit).toBe(false);
  });
});

describe('select judge', () => {
  it('right choice hits, wrong choice misses, other controls fall through, expiry misses', () => {
    const mk = () => statesFor({ targets: [{ type: 'select', c: 'chSelect1', choices: ['chSelect1', 'chSelect2'], t: 0, t1: 4 }] });
    let s = mk();
    expect(judgeSelectPress(s, 'playA', 1)).toBeNull();
    expect((judgeSelectPress(s, 'chSelect1', 1) as SelectState).hit).toBe(true);
    s = mk();
    expect((judgeSelectPress(s, 'chSelect2', 1) as SelectState).miss).toBe(true);
    s = mk();
    expect(judgeSelectPress(s, 'chSelect1', 5)).toBeNull();
    expect(expireSelects(s, 5)).toEqual([0]);
  });
});

describe('expansion', () => {
  it('alternate → taps for press controls, cuts for continuous; step → taps plus exit; sequence shifts and groups', () => {
    const taps = expandTargets([{ type: 'alternate', c: 'hcA1', t: 0, n: 4, step: 0.5 }], { hcA1: 'tap' });
    expect(taps.map((t) => t.type === 'tap' && t.t)).toEqual([0, 0.5, 1, 1.5]);
    expect(taps[3]!.group).toEqual({ id: 0, kind: 'alternate', index: 3, size: 4 });
    const cuts = expandTargets([{ type: 'alternate', c: 'xf', t: 0, n: 3, step: 1 }], { xf: 'cc' });
    expect(cuts.map((t) => t.type === 'cut' && [t.v0, t.v1])).toEqual([[0, 1], [1, 0], [0, 1]]);
    const steps = expandTargets([{ type: 'step', c: 'loopA', t: 32, step: 4, count: 3, exitC: 'loopOutA', exitAt: 48 }]);
    expect(steps.map((t) => t.type === 'tap' && [t.c, t.t])).toEqual([['loopA', 32], ['loopA', 36], ['loopA', 40], ['loopOutA', 48]]);
    const seq = expandTargets([{ type: 'sequence', t: 60, steps: [{ type: 'tap', c: 'beatFxOn', t: 3 }, { type: 'cut', c: 'faderA', t: 3.5, v0: 1, v1: 0 }, { type: 'tap', c: 'playB', t: 4 }] }]);
    expect(seq.map((t) => t.t)).toEqual([63, 63.5, 64]);
    expect(seq.every((t) => t.group?.kind === 'sequence')).toBe(true);
  });

  it('target controls and ends cover every type', () => {
    expect(targetControls({ type: 'cross', c: 'a', c2: 'b', t: 0, t1: 1, va0: 0, va1: 1, vb0: 1, vb1: 0 })).toEqual(['a', 'b']);
    expect(targetControls({ type: 'select', c: 'x', choices: ['x', 'y'], t: 0, t1: 1 })).toEqual(['x', 'y']);
    expect(targetEnd({ type: 'alternate', c: 'p', t: 2, n: 4, step: 0.5 })).toBe(3.5);
    expect(targetEnd({ type: 'step', c: 'p', t: 0, step: 4, count: 2, exitAt: 16 })).toBe(16);
  });

  it('schema rejects bad compound targets', () => {
    const base = { id: 'x', name: 'x', tier: 'T', profile: 'flx4', bpm: 120, bars: 4, lesson: '' };
    expect(() => parseDrill({ ...base, targets: [{ type: 'select', c: 'a', choices: ['b', 'c'], t: 0, t1: 1 }] })).toThrow();
    expect(() => parseDrill({ ...base, targets: [{ type: 'cross', c: 'a', c2: 'a', t: 0, t1: 1, va0: 0, va1: 1, vb0: 1, vb1: 0 }] })).toThrow();
    expect(() => parseDrill({ ...base, targets: [{ type: 'sequence', t: 0, steps: [{ type: 'tap', c: 'a', t: 0 }] }] })).toThrow();
  });
});

describe('stats with groups', () => {
  it('halves the score of sequence steps hit out of order and reports technique sub-score', () => {
    const states = statesFor({ targets: [{ type: 'sequence', t: 0, steps: [{ type: 'tap', c: 'a', t: 0 }, { type: 'tap', c: 'b', t: 0.2 }] }, { type: 'select', c: 'x', choices: ['x', 'y'], t: 0, t1: 4 }] });
    // hit b first (at its own time), then a later
    judgeTap(states, 'b', 0.2, BPM, T);
    judgeTap(states, 'a', 0.3, BPM, T);
    judgeSelectPress(states, 'x', 1);
    expect(orderViolations(states)).toBe(1); // b (index 1) was hit before a (index 0)
    const s2 = statesFor({ targets: [{ type: 'sequence', t: 0, steps: [{ type: 'tap', c: 'a', t: 0 }, { type: 'tap', c: 'b', t: 0.2 }] }] });
    judgeTap(s2, 'b', 0.1, BPM, T);
    judgeTap(s2, 'a', 0.3, BPM, T);
    // b (index 1) hit at 0.1, a (index 0) hit at 0.3 → b came before a → violation on b
    expect(orderViolations(s2)).toBe(1);
    const st = computeStats(s2, T);
    const aScore = 1 - Math.abs((0.3 - 0) * 500) / 150;
    const bScore = (1 - Math.abs((0.1 - 0.2) * 500) / 150) * 0.5;
    expect(st.score).toBe(Math.round((100 * (aScore + bScore)) / 2));
    expect((states[0] as TapState).hitAt).toBe(0.3);
    expect(computeStats(states, T).sub.technique).toBe(100);
  });
});
