import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../src/scoring/thresholds';
import { statesFor, type NoteState } from '../src/scoring/judges/state';
import { dueGroup, nextUnhit, judgeNoteOn, expireNotes, expectedNotes, noteAccuracy } from '../src/scoring/judges/note';

const T = DEFAULT_THRESHOLDS;
const chord = statesFor({
  targets: [
    { type: 'note', n: 60, t: 0, d: 1, hand: 'R' },
    { type: 'note', n: 64, t: 0, d: 1, hand: 'R' },
    { type: 'note', n: 48, t: 0, d: 4, hand: 'L' },
    { type: 'note', n: 62, t: 1, d: 1, hand: 'R' },
  ],
});

describe('wait mode', () => {
  it('due group is every unhit active note at exactly pos', () => {
    expect(dueGroup(chord, 0, 'B').map((n) => n.n)).toEqual([60, 64, 48]);
    expect(dueGroup(chord, 0, 'R').map((n) => n.n)).toEqual([60, 64]);
    expect(dueGroup(chord, 0.5, 'B')).toEqual([]);
  });

  it('hits only due notes; others are wrong; group empties as notes are hit', () => {
    const s = statesFor({ targets: [{ type: 'note', n: 60, t: 0, d: 1 }, { type: 'note', n: 64, t: 0, d: 1 }] });
    expect(judgeNoteOn(s, 62, 0, 70, 'wait', 'B', T).target).toBeNull();
    expect(judgeNoteOn(s, 60, 0, 70, 'wait', 'B', T).target?.n).toBe(60);
    expect(dueGroup(s, 0, 'B').map((n) => n.n)).toEqual([64]);
    expect(judgeNoteOn(s, 60, 0, 70, 'wait', 'B', T).target).toBeNull();
    expect(judgeNoteOn(s, 64, 0, 70, 'wait', 'B', T).target?.n).toBe(64);
    expect(dueGroup(s, 0, 'B')).toEqual([]);
    expect(nextUnhit(s, 0, 'B')).toBeNull();
  });

  it('nextUnhit respects the hand filter', () => {
    const s = statesFor({ targets: [{ type: 'note', n: 48, t: 0, d: 1, hand: 'L' }, { type: 'note', n: 60, t: 2, d: 1, hand: 'R' }] });
    expect(nextUnhit(s, 0, 'R')?.n).toBe(60);
    expect(nextUnhit(s, 0, 'L')?.n).toBe(48);
  });
});

describe('play-along', () => {
  it('nearest note of that pitch within ±0.3 beat, else wrong; expiry marks misses', () => {
    const s = statesFor({ targets: [{ type: 'note', n: 60, t: 0, d: 1 }, { type: 'note', n: 60, t: 1, d: 1 }] });
    const j = judgeNoteOn(s, 60, 0.8, 120, 'play', 'B', T);
    expect(j.target?.t).toBe(1);
    expect((j.target as NoteState).errMs).toBeCloseTo(-100);
    expect(j.tier).toBe('ok'); // |−100 ms| is inside the 140 ms OK window

    expect(judgeNoteOn(s, 60, 0.5, 120, 'play', 'B', T).target).toBeNull();
    expect(expireNotes(s, 0.31, 'B', T)).toEqual([0]);
    expect(expireNotes(s, 0.31, 'B', T)).toEqual([]);
  });

  it('expected notes are those sounding now and unhit', () => {
    expect(expectedNotes(chord, 0.5, 'B').map((n) => n.n)).toEqual([60, 64, 48]);
    expect(expectedNotes(chord, 1.5, 'B').map((n) => n.n)).toEqual([48, 62]);
  });

  it('accuracy is correct over everything that happened', () => {
    expect(noteAccuracy(0, 0, 0)).toBeNull();
    expect(noteAccuracy(3, 1, 0)).toBe(75);
    expect(noteAccuracy(1, 0, 2)).toBe(33);
  });
});
