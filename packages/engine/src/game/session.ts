import type { InputEvent } from '../scoring/attempt';

/**
 * Session mode: score a free mix against a loose phrase grid. Every "move" (a large change
 * on a fader/EQ/filter, or a transport press) is judged by its distance to the nearest
 * phrase boundary; the score is the share of moves that land within the window.
 */
export interface SessionMove {
  t: number;
  c: string;
  /** Beats from the nearest phrase boundary (signed). */
  offBeats: number;
  onGrid: boolean;
}

export interface SessionScore {
  moves: SessionMove[];
  onGrid: number;
  score: number | null;
  /** Mean absolute offset in beats. */
  meanOff: number | null;
}

export function sessionScore(log: readonly InputEvent[], phraseBeats = 32, windowBeats = 1, minDelta = 0.25): SessionScore {
  const last: Record<string, number> = {};
  const moves: SessionMove[] = [];
  for (const e of log) {
    const isPress = e.v === 1 && !(e.c in last);
    const prev = last[e.c];
    let big = false;
    if (e.c.startsWith('play') || e.c.startsWith('cue') || e.c.startsWith('loop') || e.c.startsWith('hc')) big = e.v === 1;
    else if (prev == null) last[e.c] = e.v;
    else if (Math.abs(e.v - prev) >= minDelta) {
      big = true;
      last[e.c] = e.v;
    }
    void isPress;
    if (!big) continue;
    const nearest = Math.round(e.t / phraseBeats) * phraseBeats;
    const off = e.t - nearest;
    moves.push({ t: e.t, c: e.c, offBeats: off, onGrid: Math.abs(off) <= windowBeats });
  }
  const onGrid = moves.filter((m) => m.onGrid).length;
  return {
    moves,
    onGrid,
    score: moves.length ? Math.round((100 * onGrid) / moves.length) : null,
    meanOff: moves.length ? moves.reduce((a, m) => a + Math.abs(m.offBeats), 0) / moves.length : null,
  };
}
