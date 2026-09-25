/** Parsed MIDI channel message. `key` is the prototype's stable id: `n:<ch>:<note>` / `c:<ch>:<cc>`. */
export type MidiEvent =
  | { kind: 'noteon'; ch: number; note: number; velocity: number; key: string }
  | { kind: 'noteoff'; ch: number; note: number; key: string }
  | { kind: 'cc'; ch: number; cc: number; raw: number; value: number; key: string };

export function noteKey(ch: number, note: number): string {
  return `n:${ch}:${note}`;
}

export function ccKey(ch: number, cc: number): string {
  return `c:${ch}:${cc}`;
}

/** Parse raw bytes. Returns null for anything but note on/off and CC. */
export function parseMidi(data: ArrayLike<number>): MidiEvent | null {
  const st = data[0];
  if (st === undefined) return null;
  const cmd = st & 0xf0;
  const ch = st & 0x0f;
  const d1 = data[1] ?? 0;
  const d2 = data[2] ?? 0;
  if (cmd === 0x90 && d2 > 0) return { kind: 'noteon', ch, note: d1, velocity: d2, key: noteKey(ch, d1) };
  if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) return { kind: 'noteoff', ch, note: d1, key: noteKey(ch, d1) };
  if (cmd === 0xb0) return { kind: 'cc', ch, cc: d1, raw: d2, value: d2 / 127, key: ccKey(ch, d1) };
  return null;
}

/**
 * Relative encoders (jog wheels) send 0x40 as "no movement", 0x41.. for forward and
 * 0x3f.. for backward. Returns signed ticks, or null if `raw` is out of range.
 */
export function relativeDelta(raw: number): number {
  return raw - 64;
}

/**
 * Qualified key for switches: the plain key plus `@<velocity>` for note-on or `@off` for
 * note-off, so positions that share a note but differ in velocity or on/off are distinct.
 */
export function switchKey(ev: MidiEvent): string {
  if (ev.kind === 'noteon') return `${ev.key}@${ev.velocity}`;
  if (ev.kind === 'noteoff') return `${ev.key}@off`;
  return `${ev.key}@${ev.raw}`;
}

/** Human-readable one-liner for the raw MIDI monitor. */
export function describeMidi(ev: MidiEvent): string {
  switch (ev.kind) {
    case 'noteon':
      return `ch ${ev.ch + 1} note ${ev.note} on · vel ${ev.velocity}`;
    case 'noteoff':
      return `ch ${ev.ch + 1} note ${ev.note} off`;
    case 'cc':
      return `ch ${ev.ch + 1} cc ${ev.cc} · ${ev.raw}`;
  }
}

/** Whether a key string encodes a note (press) or a CC (continuous) source. */
export function keyKind(key: string): 'note' | 'cc' | null {
  if (key.startsWith('n:')) return 'note';
  if (key.startsWith('c:')) return 'cc';
  return null;
}
