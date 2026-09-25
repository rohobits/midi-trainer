import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS, resolveThresholds } from '../src/scoring/thresholds';
import { judgeTap, expireTaps, tapScore, beatsToMs } from '../src/scoring/judges/tap';
import { sampleRamps, finishRamps, rampScore, rampExpected } from '../src/scoring/judges/ramp';
import { statesFor, type TapState, type RampState } from '../src/scoring/judges/state';
import { computeStats } from '../src/scoring/score';
import { tierFor, timingOf } from '../src/scoring/tiers';
import { medalFor, passed } from '../src/scoring/medals';

const T = DEFAULT_THRESHOLDS;
const BPM = 125;
const ms = (beats: number) => beatsToMs(beats, BPM);

describe('tap judge (prototype numbers)', () => {
  it('30 ms late at 125 BPM scores 0.8 and tiers perfect', () => {
    const states = statesFor({ targets: [{ type: 'tap', c: 'hcA1', t: 4 }] });
    const j = judgeTap(states, 'hcA1', 4 + 30 / ms(1), BPM, T);
    const s = j.target as TapState;
    expect(s.hit).toBe(true);
    expect(s.errMs).toBeCloseTo(30, 6);
    expect(tapScore(s.errMs!, T)).toBeCloseTo(0.8, 6);
    expect(s.tier).toBe('perfect');
  });

  it('tiers: 60 ms great, 120 ms ok, 160 ms miss (still a hit inside the beat window)', () => {
    expect(tierFor(60, T)).toBe('great');
    expect(tierFor(-120, T)).toBe('ok');
    expect(tierFor(160, T)).toBe('miss');
    expect(tierFor(60, T, 0.5)).toBe('ok');
    const states = statesFor({ targets: [{ type: 'tap', c: 'p', t: 0 }] });
    const j = judgeTap(states, 'p', 160 / ms(1), BPM, T); // 160 ms = 0.33 beat < 0.35 window
    expect(j.target?.hit).toBe(true);
    expect(j.target?.tier).toBe('miss');
    expect(tapScore(160, T)).toBe(0);
  });

  it('nearest candidate wins, wrong control is extra, outside window is extra', () => {
    const states = statesFor({ targets: [{ type: 'tap', c: 'p', t: 0 }, { type: 'tap', c: 'p', t: 1 }] });
    const j = judgeTap(states, 'p', 0.7, BPM, T);
    expect(j.target?.t).toBe(1);
    expect(judgeTap(states, 'q', 0.7, BPM, T).target).toBeNull();
    expect(judgeTap(states, 'p', 0.4, BPM, T).target).toBeNull(); // t=0 is 0.4 away, t=1 is hit already
  });

  it('a hit target is not judged twice; expiry marks misses once', () => {
    const states = statesFor({ targets: [{ type: 'tap', c: 'p', t: 0 }, { type: 'tap', c: 'p', t: 8 }] });
    judgeTap(states, 'p', 0.1, BPM, T);
    expect(judgeTap(states, 'p', 0.1, BPM, T).target).toBeNull();
    expect(expireTaps(states, 8.36, T)).toEqual([1]);
    expect(expireTaps(states, 9, T)).toEqual([]);
    expect((states[1] as TapState).tier).toBe('miss');
  });

  it('early/late classification with dead band', () => {
    expect(timingOf(-30)).toBe('early');
    expect(timingOf(30)).toBe('late');
    expect(timingOf(5)).toBe('on');
  });
});

describe('ramp judge (prototype numbers)', () => {
  it('expected value interpolates; hold is a flat ramp', () => {
    const s = statesFor({ targets: [{ type: 'hold', c: 'f', t: 0, t1: 4, v: 0.5 }] })[0] as RampState;
    expect(s.source).toBe('hold');
    expect(rampExpected(s, 2)).toBe(0.5);
    expect(rampExpected({ t: 0, t1: 4, v0: 0, v1: 1 }, 1)).toBeCloseTo(0.25);
  });

  it('mean error 0.15 is a hit scoring 0.5; 0.20 is a miss scoring 1/3', () => {
    expect(rampScore(0.15, T)).toBeCloseTo(0.5);
    expect(rampScore(0.2, T)).toBeCloseTo(1 / 3);
    const states = statesFor({ targets: [{ type: 'ramp', c: 'f', t: 0, t1: 4, v0: 0, v1: 1 }] });
    for (let pos = 0; pos <= 4; pos += 0.5) sampleRamps(states, pos, { f: pos / 4 + 0.15 });
    expect(finishRamps(states, 4.01, T)).toEqual([0]);
    const s = states[0] as RampState;
    expect(s.err).toBeCloseTo(0.15, 6);
    expect(s.hit).toBe(true);
  });

  it('a ramp never sampled scores error 1 and is done exactly once', () => {
    const states = statesFor({ targets: [{ type: 'ramp', c: 'f', t: 0, t1: 1, v0: 0, v1: 1 }] });
    expect(finishRamps(states, 5, T)).toEqual([0]);
    expect((states[0] as RampState).err).toBe(1);
    expect(finishRamps(states, 6, T)).toEqual([]);
  });

  it('does not sample outside the ramp span', () => {
    const states = statesFor({ targets: [{ type: 'ramp', c: 'f', t: 2, t1: 4, v0: 0, v1: 1 }] });
    sampleRamps(states, 1, { f: 1 });
    sampleRamps(states, 5, { f: 1 });
    expect((states[0] as RampState).errN).toBe(0);
  });
});

describe('stats and medals', () => {
  it('score is the mean over completed targets only', () => {
    const states = statesFor({ targets: [{ type: 'tap', c: 'p', t: 0 }, { type: 'tap', c: 'p', t: 4 }, { type: 'ramp', c: 'f', t: 0, t1: 2, v0: 0, v1: 0 }] });
    expect(computeStats(states, T).score).toBeNull();
    judgeTap(states, 'p', 30 / ms(1), BPM, T);
    let st = computeStats(states, T);
    expect(st.score).toBe(80);
    expect(st.completed).toBe(1);
    expect(st.total).toBe(3);
    expect(st.tiers.perfect).toBe(1);
    for (let pos = 0; pos <= 2; pos += 0.25) sampleRamps(states, pos, { f: 0.15 });
    finishRamps(states, 2.1, T);
    st = computeStats(states, T);
    expect(st.score).toBe(Math.round((100 * (0.8 + 0.5)) / 2));
    expect(st.sub.tracking).toBe(85);
    expect(st.timingMeanMs).toBe(30);
    expect(st.timingBiasMs).toBe(30);
    expect(st.timingSdMs).toBe(0);
  });

  it('medal boundaries at 80/90/96', () => {
    expect(medalFor(79)).toBeNull();
    expect(medalFor(80)).toBe('bronze');
    expect(medalFor(90)).toBe('silver');
    expect(medalFor(96)).toBe('gold');
    expect(medalFor(null)).toBeNull();
    expect(passed(80)).toBe(true);
    expect(passed(84, 85)).toBe(false);
  });

  it('thresholds resolve settings < drill', () => {
    expect(resolveThresholds({ thresholds: { tapZeroMs: 100 } }, { tapZeroMs: 200, rampHit: 0.1 })).toMatchObject({ tapZeroMs: 100, rampHit: 0.1, tapWindowBeats: 0.35 });
  });
});
