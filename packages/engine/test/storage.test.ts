import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { readLegacy } from '../src/storage/migrate-localstorage';
import { TrainerDb } from '../src/storage/db';

function storage(obj: Record<string, unknown>) {
  return { getItem: (k: string) => (k in obj ? JSON.stringify(obj[k]) : null) };
}

describe('readLegacy', () => {
  it('reads prototype keys and marks the map unverified', () => {
    const r = readLegacy(
      storage({
        'djt-map': { playA: 'n:0:11' },
        'djt-best': { 'Phrase counting': 88 },
        'djt-settings': { click: true, loop: false, auto: false },
        'pt-settings': { mode: 'play', hand: 'R', guide: true },
      }),
    );
    expect(r.map).toEqual({ playA: { key: 'n:0:11', verified: false } });
    expect(r.bestByName).toEqual({ 'Phrase counting': 88 });
    expect(r.settings).toEqual({ click: true, loop: false, autoStart: false, noteMode: 'play', hand: 'R', guide: true });
  });
  it('tolerates missing and corrupt values', () => {
    const r = readLegacy({ getItem: (k) => (k === 'djt-map' ? '{not json' : null) });
    expect(r).toEqual({ map: null, bestByName: null, settings: {} });
  });
});

describe('TrainerDb', () => {
  it('stores settings, maps and attempts; best scores derive from attempts', async () => {
    const db = new TrainerDb('test-' + Math.random());
    const s = await db.getSettings();
    expect(s.autoStartControl).toBe('playA');
    await db.saveSettings({ click: true });
    expect((await db.getSettings()).click).toBe(true);
    await db.saveMap('flx4', { playA: { key: 'n:0:11', verified: true } });
    expect(await db.getMap('flx4')).toEqual({ playA: { key: 'n:0:11', verified: true } });
    const base = {
      drillId: 'x', profile: 'flx4', startedAt: 1, endedAt: 2, bpm: 125, passed: true, medal: 'bronze' as const,
      timingMeanMs: 20, timingSdMs: 5, trackingMean: null, tiers: { perfect: 1, great: 0, ok: 0, miss: 0 },
      subScores: { timing: 85, tracking: null }, extraPresses: 0, inputOffsetMs: 0, strictness: 1, perTarget: [], inputLog: [],
    };
    await db.attempts.add({ ...base, score: 85 });
    await db.attempts.add({ ...base, score: 91, startedAt: 3 });
    await db.attempts.add({ ...base, drillId: 'y', score: null });
    expect(await db.bestScores()).toEqual({ x: 91 });
    expect((await db.attemptsFor('x')).map((a) => a.score)).toEqual([85, 91]);
    db.close();
  });
});
