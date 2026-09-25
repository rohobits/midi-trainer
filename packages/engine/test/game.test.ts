import { describe, expect, it } from 'vitest';
import { mulberry32, hashString, dayKey, addDays, daysBetween } from '../src/game/random';
import { practiceByDay, streakInfo, calendar, TROPHY_DAYS } from '../src/game/goals';
import { xpForAttempt, levelFor, totalXp } from '../src/game/xp';
import { records, tierReady } from '../src/game/records';
import { reviewStates, dueToday } from '../src/game/review';
import { densityVariant, generateFromTemplate, TEMPLATES } from '../src/game/generate';
import { dailyChallenge } from '../src/game/challenge';
import { buildLadder, startPlacement, recordPlacement, placementResult } from '../src/game/placement';
import { MidiClock } from '../src/midi/clock';
import { sessionScore } from '../src/game/session';
import { parseDrill } from '../src/drills/schema';
import type { AttemptRecord } from '../src/scoring/attempt';

const day = (k: string, hour = 12) => {
  const [y, m, d] = k.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hour).getTime();
};
const attempt = (drillId: string, startKey: string, score: number, minutes = 3, medal: AttemptRecord['medal'] = null): AttemptRecord => ({
  drillId, profile: 'flx4', startedAt: day(startKey), endedAt: day(startKey) + minutes * 60000, bpm: 125, score, passed: score >= 80, medal,
  timingMeanMs: 20, timingSdMs: 5, trackingMean: null, tiers: { perfect: 1, great: 0, ok: 0, miss: 0 }, subScores: { timing: score, tracking: null },
  extraPresses: 0, inputOffsetMs: 0, strictness: 1, perTarget: [], inputLog: [],
});
const drill = (id: string, tier: string, level = 1) => parseDrill({ id, name: id, tier, profile: 'flx4', bpm: 125, bars: 4, lesson: '', level, targets: [{ type: 'tap', c: 'hcA1', t: 0 }, { type: 'tap', c: 'hcA2', t: 2 }, { type: 'alternate', c: 'hcA3', t: 4, n: 8, step: 0.5 }] });

describe('random and days', () => {
  it('is deterministic and hashes stably', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(hashString('daily:2026-09-25')).toBe(hashString('daily:2026-09-25'));
    expect(hashString('a')).not.toBe(hashString('b'));
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(daysBetween('2026-01-01', '2026-01-08')).toBe(7);
    expect(dayKey(new Date(2026, 8, 5))).toBe('2026-09-05');
  });
});

describe('goals, streaks, trophies, calendar', () => {
  it('counts goal-days, current and longest streaks, weekly streak and trophies', () => {
    const atts = [
      attempt('a', '2026-09-20', 90, 6), attempt('a', '2026-09-21', 90, 2), attempt('b', '2026-09-21', 90, 4),
      attempt('a', '2026-09-23', 90, 5), attempt('a', '2026-09-24', 90, 5), attempt('a', '2026-09-25', 90, 1),
    ];
    const byDay = practiceByDay(atts, 5);
    expect(byDay.get('2026-09-21')?.met).toBe(true);
    expect(byDay.get('2026-09-22')).toBeUndefined();
    const s = streakInfo(byDay, '2026-09-25');
    expect(s.todayMet).toBe(false);
    expect(s.current).toBe(2); // 23, 24 (today not met yet, so counted from yesterday)
    expect(s.longest).toBe(2);
    expect(s.goalDays).toBe(4);
    expect(s.earnedTrophies).toEqual([3]);
    expect(s.nextTrophy).toBe(5);
    expect(s.weekly).toBeGreaterThanOrEqual(1);
    expect(TROPHY_DAYS[0]).toBe(3);
    const cal = calendar(byDay, 2, '2026-09-25');
    expect(cal).toHaveLength(2);
    expect(cal[1]!.some((d) => d.day === '2026-09-25')).toBe(true);
  });
});

describe('xp and levels', () => {
  it('rewards accuracy, medals, personal bests; levels grow quadratically', () => {
    expect(xpForAttempt({ score: 90, medal: 'silver', mode: 'lesson' }, true)).toBe(45 + 25 + 20);
    expect(xpForAttempt({ score: null, medal: null }, false)).toBe(0);
    expect(levelFor(0)).toEqual({ level: 1, into: 0, next: 300 });
    expect(levelFor(400).level).toBe(2);
    expect(levelFor(799).level).toBe(2);
    expect(levelFor(800).level).toBe(3);
    const atts = [attempt('a', '2026-09-20', 80, 3, 'bronze'), attempt('a', '2026-09-21', 70, 3), attempt('a', '2026-09-22', 96, 3, 'gold')];
    expect(totalXp(atts)).toBe(40 + 10 + 20 + 35 + 48 + 50 + 20);
  });
});

describe('records and tier readiness', () => {
  it('a gold unlocks a record per drill; tier ready needs bronze on the last three of every drill', () => {
    const drills = [drill('a', 'Foundations'), drill('b', 'Foundations')];
    const atts = [attempt('a', '2026-09-20', 97, 3, 'gold'), attempt('a', '2026-09-21', 98, 3, 'gold'), attempt('b', '2026-09-20', 85, 3, 'bronze')];
    const albums = records(atts, drills);
    expect(albums.get('Foundations')?.map((r) => r.drillId)).toEqual(['a']);
    expect(tierReady(atts, drills, 'Foundations')).toEqual({ ready: false, missing: ['a', 'b'] });
    const more = [...atts, attempt('a', '2026-09-22', 90), attempt('b', '2026-09-21', 85), attempt('b', '2026-09-22', 85)];
    expect(tierReady(more, drills, 'Foundations').ready).toBe(true);
  });
});

describe('spaced review', () => {
  it('expands intervals with consecutive passes and resets on a fail', () => {
    const atts = [attempt('a', '2026-09-10', 85), attempt('a', '2026-09-11', 85), attempt('b', '2026-09-24', 60), attempt('b', '2026-09-20', 85)];
    const rs = reviewStates(atts, '2026-09-25');
    const a = rs.find((r) => r.drillId === 'a')!;
    expect(a.streak).toBe(2);
    expect(a.due).toBe('2026-09-14');
    expect(a.overdueDays).toBe(11);
    const b = rs.find((r) => r.drillId === 'b')!;
    expect(b.streak).toBe(0);
    expect(b.due).toBe('2026-09-25');
    expect(dueToday(atts, '2026-09-25').map((r) => r.drillId)).toEqual(['a', 'b']);
    expect(reviewStates([attempt('c', '2026-09-24', 50)], '2026-09-25')).toEqual([]);
  });
});

describe('generation and daily challenge', () => {
  it('density variants keep continuous targets and are reproducible', () => {
    const d = drill('a', 'Foundations');
    const v1 = densityVariant(d, 0.5, 7);
    const v2 = densityVariant(d, 0.5, 7);
    expect(v1.targets).toEqual(v2.targets);
    expect(v1.targets.length).toBeLessThan(10);
    expect(v1.targets.every((t) => t.type === 'tap')).toBe(true);
    expect(v1.variantOf).toBe('a');
    expect(() => parseDrill(v1)).not.toThrow();
  });
  it('templates produce valid drills', () => {
    for (const name of Object.keys(TEMPLATES)) {
      const g = generateFromTemplate(name, { bars: 8, bpm: 125, seed: 3 });
      expect(() => parseDrill(g), name).not.toThrow();
      expect(g.bars).toBeGreaterThanOrEqual(8);
    }
  });
  it('daily challenge is the same for the same day and differs across days', () => {
    const drills = [drill('a', 'Foundations'), drill('b', 'Mixing')];
    const x = dailyChallenge(drills, '2026-09-25');
    const y = dailyChallenge(drills, '2026-09-25');
    expect(x.drill.id).toBe('daily-2026-09-25');
    expect(x.seed).toBe(y.seed);
    expect(x.drill.targets).toEqual(y.drill.targets);
    expect(() => parseDrill(x.drill)).not.toThrow();
    const z = dailyChallenge(drills, '2026-09-26');
    expect(z.seed).not.toBe(x.seed);
  });
});

describe('placement', () => {
  it('climbs on passes, drops on fails, ends after three setbacks, maps to a benchmark', () => {
    const drills = [drill('f1', 'Foundations', 1), drill('f2', 'Foundations', 2), drill('m1', 'Mixing', 1), drill('m2', 'Mixing', 2), drill('p1', 'Performance', 1), drill('a1', 'Advanced', 1)];
    const ladder = buildLadder(drills);
    expect(ladder).toEqual(['f1', 'f2', 'm1', 'm2', 'p1', 'a1']);
    let s = startPlacement(ladder);
    expect(s.index).toBe(2);
    s = recordPlacement(s, 90);
    expect(s.index).toBe(4);
    s = recordPlacement(s, 50);
    s = recordPlacement(s, 50);
    s = recordPlacement(s, 50);
    expect(s.finished).toBe(true);
    expect(s.best).toBe(2);
    const r = placementResult(s);
    expect(r.score).toBe(100 + Math.round((1800 * 2) / 5));
    expect(r.benchmark).toBe('House party');
  });
});

describe('MIDI clock', () => {
  it('estimates BPM from ticks and measures drift', () => {
    const c = new MidiClock();
    c.feed([0xfa], 0);
    const perTick = 60000 / 120 / 24;
    for (let i = 0; i < 50; i++) c.feed([0xf8], i * perTick);
    expect(c.bpm).toBe(120);
    expect(c.snapshot().running).toBe(true);
    expect(c.snapshot().beat).toBeCloseTo(50 / 24);
    expect(c.feed([0x90, 1, 1], 0)).toBe(false);
    expect(MidiClock.driftMs(4.0, 4.1, 120)).toBeCloseTo(50);
    expect(MidiClock.driftMs(4.9, 5.0, 120)).toBeCloseTo(50);
  });
});

describe('session score', () => {
  it('judges big moves by distance to the phrase grid', () => {
    const log = [
      { t: 0, c: 'faderB', v: 0 }, { t: 31.5, c: 'faderB', v: 1 }, { t: 40, c: 'faderA', v: 1 }, { t: 48, c: 'faderA', v: 0 },
      { t: 64.2, c: 'playB', v: 1 }, { t: 70, c: 'lowA', v: 0.5 }, { t: 70.5, c: 'lowA', v: 0.45 },
    ];
    const s = sessionScore(log, 32, 1);
    expect(s.moves.map((m) => m.c)).toEqual(['faderB', 'faderA', 'playB']);
    expect(s.onGrid).toBe(2);
    expect(s.score).toBe(67);
  });
});
