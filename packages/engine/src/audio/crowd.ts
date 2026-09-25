import type { StemName } from './patterns';

/**
 * Song mode crowd meter (Fuser pattern): decays slowly, rises on changes that land on a
 * downbeat or phrase boundary, drops on off-grid changes and silence. Requests ask for a
 * specific move within a deadline for a bonus.
 */
export interface CrowdRequest {
  id: number;
  text: string;
  /** Beat by which it must be done. */
  deadline: number;
  check: (ev: CrowdEvent) => boolean;
  done: boolean;
}

export type CrowdEvent =
  | { kind: 'stem'; deck: 'A' | 'B'; stem: StemName; on: boolean; beat: number }
  | { kind: 'transition'; beat: number }
  | { kind: 'fx'; beat: number }
  | { kind: 'cue'; deck: 'A' | 'B'; beat: number };

export class Crowd {
  meter = 0.5;
  score = 0;
  private samples = 0;
  private lastChangeBeat = 0;
  requests: CrowdRequest[] = [];
  private nextId = 1;
  private history: { beat: number; onGrid: boolean }[] = [];

  /** Advance to `beat`; called every frame while the set runs. */
  tick(beat: number, dtBeats: number): void {
    // Slow decay; faster if nothing has changed for 16 bars.
    const stale = beat - this.lastChangeBeat > 64;
    this.meter = Math.max(0, this.meter - dtBeats * (stale ? 0.004 : 0.0015));
    this.score += this.meter * dtBeats;
    this.samples += dtBeats;
    for (const r of this.requests) if (!r.done && beat > r.deadline) r.done = true;
  }

  /** A move happened. Grid = downbeat (any bar) is +, phrase (8 bars) is ++, off-grid is −. */
  event(ev: CrowdEvent): { onGrid: boolean; phrase: boolean; delta: number } {
    const beat = ev.beat;
    const offBar = Math.abs(beat - Math.round(beat / 4) * 4);
    const offPhrase = Math.abs(beat - Math.round(beat / 32) * 32);
    const onGrid = offBar <= 0.35;
    const phrase = offPhrase <= 0.35;
    let delta = onGrid ? (phrase ? 0.12 : 0.05) : -0.06;
    for (const r of this.requests) {
      if (!r.done && beat <= r.deadline && r.check(ev)) {
        r.done = true;
        delta += 0.15;
      }
    }
    this.meter = Math.max(0, Math.min(1, this.meter + delta));
    this.lastChangeBeat = beat;
    this.history.push({ beat, onGrid });
    return { onGrid, phrase, delta };
  }

  /** Issue a request due in `bars` bars. */
  request(text: string, beat: number, bars: number, check: (ev: CrowdEvent) => boolean): CrowdRequest {
    const r: CrowdRequest = { id: this.nextId++, text, deadline: beat + bars * 4, check, done: false };
    this.requests.push(r);
    return r;
  }

  get open(): CrowdRequest[] {
    return this.requests.filter((r) => !r.done);
  }

  /** Average meter over the set, ×100, and stars. */
  result(): { average: number; stars: number; moves: number; onGrid: number; fulfilled: number } {
    const average = this.samples ? Math.round((100 * this.score) / this.samples) : 0;
    const stars = average >= 85 ? 5 : average >= 70 ? 4 : average >= 55 ? 3 : average >= 40 ? 2 : average > 0 ? 1 : 0;
    return { average, stars, moves: this.history.length, onGrid: this.history.filter((h) => h.onGrid).length, fulfilled: this.requests.filter((r) => r.done && r.deadline >= 0).length };
  }
}
