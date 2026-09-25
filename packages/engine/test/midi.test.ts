import { describe, expect, it } from 'vitest';
import { parseMidi, relativeDelta, keyKind } from '../src/midi/parse';
import { reverseMap, exportMap, importMap, mappedControls } from '../src/midi/map';
import { LearnSession } from '../src/midi/learn';
import { GENERIC_CONTROLS } from '../src/profiles/generic/controls';
import { FLX4_CONTROLS, FLX4_PROFILE } from '../src/profiles/flx4/controls';
import { defaultValues } from '../src/profiles/types';

describe('parseMidi', () => {
  it('encodes keys like the prototype', () => {
    expect(parseMidi([0x90, 11, 127])).toMatchObject({ kind: 'noteon', ch: 0, note: 11, key: 'n:0:11' });
    expect(parseMidi([0x91, 11, 0])).toMatchObject({ kind: 'noteoff', ch: 1, key: 'n:1:11' });
    expect(parseMidi([0x80, 11, 64])).toMatchObject({ kind: 'noteoff' });
    expect(parseMidi([0xb6, 19, 127])).toMatchObject({ kind: 'cc', ch: 6, cc: 19, value: 1, key: 'c:6:19' });
    expect(parseMidi([0xb0, 19, 0])?.kind === 'cc' && parseMidi([0xb0, 19, 0])).toMatchObject({ value: 0 });
    expect(parseMidi([0xe0, 0, 64])).toBeNull();
    expect(parseMidi([])).toBeNull();
  });
  it('relative encoder delta and key kinds', () => {
    expect(relativeDelta(0x41)).toBe(1);
    expect(relativeDelta(0x3f)).toBe(-1);
    expect(keyKind('n:0:1')).toBe('note');
    expect(keyKind('c:0:1')).toBe('cc');
    expect(keyKind('x')).toBeNull();
  });
});

describe('control map', () => {
  it('round-trips export/import and reads the prototype shape as unverified', () => {
    const map = { playA: { key: 'n:0:11', verified: true }, faderA: { key: 'c:0:19', verified: false } };
    const file = exportMap('flx4', map, 'DDJ-FLX4');
    expect(file.version).toBe(1);
    expect(importMap(JSON.parse(JSON.stringify(file)))).toEqual({ profile: 'flx4', map });
    const legacy = importMap({ playA: 'n:0:11', bogus: 'nope' });
    expect(legacy.profile).toBeNull();
    expect(legacy.map).toEqual({ playA: { key: 'n:0:11', verified: false } });
    expect(() => importMap(42)).toThrow();
    expect(reverseMap(map)).toEqual({ 'n:0:11': 'playA', 'c:0:19': 'faderA' });
    expect([...mappedControls(map)]).toEqual(['playA', 'faderA']);
  });
});

describe('LearnSession', () => {
  it('press controls take note-on only, continuous take CC only, queue advances', () => {
    const map = {};
    const s = new LearnSession(GENERIC_CONTROLS, map);
    s.arm('playA');
    expect(s.offer(parseMidi([0xb0, 1, 5])!)).toBeNull();
    expect(s.offer(parseMidi([0x90, 11, 100])!)).toBe('playA');
    expect(s.current).toBeNull();
    s.armAll(['faderA', 'cueA']);
    expect(s.offer(parseMidi([0x90, 12, 100])!)).toBeNull();
    expect(s.offer(parseMidi([0xb0, 19, 64])!)).toBe('faderA');
    expect(s.current).toBe('cueA');
    expect(s.offer(parseMidi([0x90, 12, 100])!)).toBe('cueA');
    expect(map).toEqual({
      playA: { key: 'n:0:11', verified: true },
      faderA: { key: 'c:0:19', verified: true },
      cueA: { key: 'n:0:12', verified: true },
    });
  });
});

describe('profiles', () => {
  it('FLX4 has unique ids, keeps prototype ids, no FX on A/B, empty default map', () => {
    const ids = FLX4_CONTROLS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['playA', 'hcA1', 'hcB4', 'faderA', 'faderB', 'xf', 'lowB', 'filtA', 'tempoB', 'loopA', 'loopOutA', 'fxLevel']) expect(ids).toContain(id);
    expect(ids).not.toContain('fxA');
    expect(ids.filter((i) => /^hc[AB]\d$/.test(i))).toHaveLength(16);
    expect(FLX4_PROFILE.capabilities).toContain('decks:2');
  });
  it('default values: faders at 0, knobs centred, taps 0', () => {
    const v = defaultValues(FLX4_PROFILE);
    expect(v.faderA).toBe(0);
    expect(v.xf).toBe(0);
    expect(v.lowA).toBe(0.5);
    expect(v.playA).toBe(0);
  });
});

describe('FLX4 default map', () => {
  it('maps only known controls, every entry verified, no two controls on the same key', async () => {
    const { FLX4_DEFAULT_MAP } = await import('../src/profiles/flx4/default-map');
    const ids = new Set(FLX4_CONTROLS.map((c) => c.id));
    const keys = new Set<string>();
    for (const [c, e] of Object.entries(FLX4_DEFAULT_MAP)) {
      expect(ids.has(c), `unknown control ${c}`).toBe(true);
      expect(e.verified, `${c} not verified`).toBe(true);
      expect(keys.has(e.key), `${c} shares key ${e.key}`).toBe(false);
      keys.add(e.key);
    }
    expect(Object.keys(FLX4_DEFAULT_MAP).length).toBeGreaterThan(150);
    expect(FLX4_DEFAULT_MAP.playA?.key).toBe('n:0:11');
  });
});
