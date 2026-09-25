import { describe, expect, it } from 'vitest';
import { parseMidiFile } from '../src/profiles/piano88/smf';

/** Minimal SMF writer for fixtures. */
function vlq(n: number): number[] {
  const out = [n & 0x7f];
  n >>= 7;
  while (n > 0) {
    out.unshift((n & 0x7f) | 0x80);
    n >>= 7;
  }
  return out;
}
function track(events: number[]): number[] {
  const body = [...events, 0x00, 0xff, 0x2f, 0x00];
  return [0x4d, 0x54, 0x72, 0x6b, (body.length >>> 24) & 0xff, (body.length >>> 16) & 0xff, (body.length >>> 8) & 0xff, body.length & 0xff, ...body];
}
function smf(tracks: number[][], div = 96, format = 1): Uint8Array {
  const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, format, 0, tracks.length, (div >> 8) & 0xff, div & 0xff];
  return new Uint8Array([...head, ...tracks.flat()]);
}

describe('parseMidiFile', () => {
  it('reads tempo, running status, vel-0 note-off, and splits one track at middle C', () => {
    const t = track([
      0, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, // 500000 µs = 120 BPM
      0, 0x90, 60, 100, // C4 on (t=0)
      ...vlq(96), 60, 0, // running status, vel 0 = off after 1 beat
      0, 0x90, 48, 100, // C3 on at t=1
      ...vlq(48), 0x80, 48, 0, // off after half beat
    ]);
    const r = parseMidiFile(smf([t]), 'fixture');
    expect(r.bpm).toBe(120);
    expect(r.notes).toEqual([
      { type: 'note', n: 60, t: 0, d: 1, hand: 'R' },
      { type: 'note', n: 48, t: 1, d: 0.5, hand: 'L' },
    ]);
  });

  it('skips channel 10, enforces 1/16 minimum, normalises to first note, quantises', () => {
    const t = track([
      ...vlq(50), 0x99, 36, 100, // drums on ch 10 at tick 50, skipped
      0, 0x89, 36, 0,
      0, 0x90, 64, 100, // E4 at tick 50
      ...vlq(3), 0x80, 64, 0, // 3 ticks long → clamped to 0.125 beat
    ]);
    const r = parseMidiFile(smf([t]));
    expect(r.notes).toEqual([{ type: 'note', n: 64, t: 0, d: 0.125, hand: 'R' }]);
    expect(r.bpm).toBe(80);
  });

  it('assigns hands across tracks by mean pitch, drops out-of-range notes', () => {
    const hi = track([0, 0x90, 72, 100, ...vlq(96), 0x80, 72, 0]);
    const lo = track([0, 0x90, 40, 100, ...vlq(96), 0x80, 40, 0, 0, 0x90, 10, 100, ...vlq(96), 0x80, 10, 0]);
    const r = parseMidiFile(smf([lo, hi]));
    expect(r.notes.map((n) => [n.n, n.hand])).toEqual([
      [40, 'L'],
      [72, 'R'],
    ]);
  });

  it('rejects non-MIDI, SMPTE and empty files', () => {
    expect(() => parseMidiFile(new Uint8Array([1, 2, 3, 4]))).toThrow(/not a MIDI/);
    expect(() => parseMidiFile(smf([track([])], 0xe250))).toThrow(/SMPTE/);
    expect(() => parseMidiFile(smf([track([])]))).toThrow(/no notes/);
  });
});
