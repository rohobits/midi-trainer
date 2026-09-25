import { describe, expect, it } from 'vitest';
import { Transport } from '../src/clock/transport';
import { TapTempo } from '../src/clock/tapTempo';
import { BeatTicker } from '../src/clock/metronome';

describe('Transport', () => {
  it('position is anchor-based, not accumulated', () => {
    const t = new Transport({ bpm: 120 });
    t.start(1000);
    expect(t.pos(1000)).toBe(0);
    expect(t.pos(1500)).toBe(1);
    expect(t.pos(1000 + 64 * 4 * 500)).toBe(256);
  });

  it('bpm change re-anchors without a jump', () => {
    const t = new Transport({ bpm: 120 });
    t.start(0);
    t.setBpm(60, 1000);
    expect(t.pos(1000)).toBe(2);
    expect(t.pos(2000)).toBe(3);
  });

  it('count-in starts negative; stop holds; seek and freeze/resume', () => {
    const t = new Transport({ bpm: 120, countInBars: 1 });
    t.start(0);
    expect(t.pos(0)).toBe(-4);
    expect(t.pos(2000)).toBe(0);
    t.stop(2500);
    expect(t.pos(9999)).toBe(1);
    expect(t.isRunning).toBe(false);
    t.start(0, 0);
    t.freeze(3);
    expect(t.pos(5000)).toBe(3);
    t.resume(5000);
    expect(t.pos(5500)).toBe(4);
    t.seek(0, 6000);
    expect(t.pos(6000)).toBe(0);
  });

  it('bar/beat display is 1-based and handles negatives', () => {
    const t = new Transport({ bpm: 120 });
    expect(t.barBeat(0)).toEqual({ bar: 1, beat: 1 });
    expect(t.barBeat(5)).toEqual({ bar: 2, beat: 2 });
    expect(t.barBeat(-1).beat).toBe(4);
  });
});

describe('TapTempo', () => {
  it('needs three taps within the window, averages intervals', () => {
    const tt = new TapTempo();
    expect(tt.tap(0)).toBeNull();
    expect(tt.tap(500)).toBeNull();
    expect(tt.tap(1000)).toBe(120);
    expect(tt.tap(1480)).toBeCloseTo(121.6, 1);
    expect(tt.tap(10000)).toBeNull(); // old taps dropped
  });
});

describe('BeatTicker', () => {
  it('reports each integer beat crossed once', () => {
    const b = new BeatTicker();
    expect(b.crossed(-0.5)).toEqual([-1]);
    expect(b.crossed(0.2)).toEqual([0]);
    expect(b.crossed(0.9)).toEqual([]);
    expect(b.crossed(3.1)).toEqual([1, 2, 3]);
  });
});
