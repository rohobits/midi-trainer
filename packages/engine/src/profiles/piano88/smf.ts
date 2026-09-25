import type { NoteTarget } from '../../drills/schema';
import { PIANO_HI, PIANO_LO } from './geometry';

export interface ParsedMidiFile {
  name: string;
  bpm: number;
  notes: NoteTarget[];
}

/**
 * Standard MIDI file → note targets, behaviour carried over from the prototype:
 * format 0/1, running status, first tempo meta wins, channel 10 (drums) skipped,
 * note-on velocity 0 = note-off, minimum duration 1/16 beat, SMPTE division rejected.
 * Hands: one track → split at middle C; several → tracks ranked by mean pitch, upper half
 * right. Times normalised to the first note and quantised to 1/16 beat. Notes outside the
 * 88-key range are dropped.
 */
export function parseMidiFile(b: Uint8Array, name = 'MIDI file'): ParsedMidiFile {
  let p = 0;
  const u8 = () => {
    const v = b[p++];
    if (v === undefined) throw new Error('unexpected end of file');
    return v;
  };
  const u16 = () => (u8() << 8) | u8();
  const u32 = () => ((u8() << 24) | (u8() << 16) | (u8() << 8) | u8()) >>> 0;
  const vlq = () => {
    let v = 0;
    let c: number;
    do {
      c = u8();
      v = (v << 7) | (c & 0x7f);
    } while (c & 0x80);
    return v;
  };
  const tag = () => String.fromCharCode(u8(), u8(), u8(), u8());

  if (tag() !== 'MThd') throw new Error('not a MIDI file');
  const hl = u32();
  u16(); // format
  const ntr = u16();
  const div = u16();
  p = 8 + hl;
  if (div & 0x8000) throw new Error('SMPTE timing not supported');

  const tracks: Array<Array<{ n: number; t: number; d: number }>> = [];
  let tempo: number | null = null;
  for (let t = 0; t < ntr; t++) {
    if (tag() !== 'MTrk') throw new Error('bad track');
    const len = u32();
    const end = p + len;
    let tick = 0;
    let status = 0;
    const open: Record<number, number> = {};
    const notes: Array<{ n: number; t: number; d: number }> = [];
    while (p < end) {
      tick += vlq();
      let s = b[p];
      if (s === undefined) throw new Error('unexpected end of track');
      if (s < 0x80) s = status;
      else {
        p++;
        status = s;
      }
      if (s === 0xff) {
        const type = u8();
        const l = vlq();
        if (type === 0x51 && tempo === null && l === 3) tempo = (u8() << 16) | (u8() << 8) | u8();
        else p += l;
      } else if (s === 0xf0 || s === 0xf7) {
        p += vlq();
      } else {
        const cmd = s & 0xf0;
        const ch = s & 0x0f;
        const d1 = u8();
        const d2 = cmd === 0xc0 || cmd === 0xd0 ? 0 : u8();
        if (ch === 9) continue;
        if (cmd === 0x90 && d2 > 0) open[d1] = tick;
        else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) {
          const start = open[d1];
          if (start != null) {
            notes.push({ n: d1, t: start / div, d: Math.max((tick - start) / div, 0.125) });
            delete open[d1];
          }
        }
      }
    }
    p = end;
    if (notes.length) tracks.push(notes);
  }
  if (!tracks.length) throw new Error('no notes found');

  let notes: NoteTarget[] = [];
  if (tracks.length === 1) {
    notes = tracks[0]!.map((n) => ({ type: 'note', n: n.n, t: n.t, d: n.d, hand: n.n < 60 ? 'L' : 'R' }));
  } else {
    const avg = (tr: Array<{ n: number }>) => tr.reduce((a, n) => a + n.n, 0) / tr.length;
    const sorted = tracks.map((tr) => ({ tr, a: avg(tr) })).sort((x, y) => y.a - x.a);
    const half = Math.ceil(sorted.length / 2);
    sorted.forEach((s, i) => {
      for (const n of s.tr) notes.push({ type: 'note', n: n.n, t: n.t, d: n.d, hand: i < half ? 'R' : 'L' });
    });
  }
  notes = notes.filter((n) => n.n >= PIANO_LO && n.n <= PIANO_HI);
  if (!notes.length) throw new Error('no notes in the 88-key range');
  const t0 = Math.min(...notes.map((n) => n.t));
  for (const n of notes) n.t = Math.round((n.t - t0) * 16) / 16;
  notes.sort((a, b) => a.t - b.t || a.n - b.n);
  return { name, bpm: tempo ? Math.round(60000000 / tempo) : 80, notes };
}
