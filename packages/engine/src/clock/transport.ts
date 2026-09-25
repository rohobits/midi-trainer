/**
 * Anchor-based transport. Position (beats) is derived from a monotonic clock, never
 * accumulated from frame deltas, so a 64-bar run does not drift and a MIDI event can be
 * judged at its own timestamp rather than the last frame's position.
 */
export interface TransportOptions {
  bpm: number;
  /** Beats per bar, default 4. */
  beatsPerBar?: number;
  /** Count-in bars before beat 0. Position starts negative. */
  countInBars?: number;
}

export class Transport {
  bpm: number;
  beatsPerBar: number;
  countInBars: number;
  private anchorPos = 0;
  private anchorTime = 0;
  private running = false;
  private frozenPos: number | null = null;

  constructor(opts: TransportOptions) {
    this.bpm = opts.bpm;
    this.beatsPerBar = opts.beatsPerBar ?? 4;
    this.countInBars = opts.countInBars ?? 0;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Start at `now` (ms) from `fromBeat` (default: minus the count-in). */
  start(now: number, fromBeat?: number): void {
    this.anchorPos = fromBeat ?? -this.countInBars * this.beatsPerBar;
    this.anchorTime = now;
    this.running = true;
    this.frozenPos = null;
  }

  stop(now: number): void {
    if (!this.running) return;
    this.anchorPos = this.pos(now);
    this.running = false;
  }

  /** Position in beats at time `now` (ms). Stable while stopped or frozen. */
  pos(now: number): number {
    if (this.frozenPos != null) return this.frozenPos;
    if (!this.running) return this.anchorPos;
    return this.anchorPos + ((now - this.anchorTime) * this.bpm) / 60000;
  }

  /** Change tempo without a jump: re-anchor at the current position. */
  setBpm(bpm: number, now: number): void {
    if (this.frozenPos == null) {
      this.anchorPos = this.pos(now);
      this.anchorTime = now;
    }
    this.bpm = bpm;
  }

  /** Jump to a position (loop restart, seek). */
  seek(beat: number, now: number): void {
    this.anchorPos = beat;
    this.anchorTime = now;
    this.frozenPos = null;
  }

  /** Wait mode: hold the position until `resume`. */
  freeze(beat: number): void {
    this.frozenPos = beat;
  }

  get isFrozen(): boolean {
    return this.frozenPos != null;
  }

  /** Resume from the frozen position at `now`. */
  resume(now: number): void {
    if (this.frozenPos == null) return;
    this.anchorPos = this.frozenPos;
    this.anchorTime = now;
    this.frozenPos = null;
  }

  msPerBeat(): number {
    return 60000 / this.bpm;
  }

  /** 1-based bar and beat for display. */
  barBeat(pos: number): { bar: number; beat: number } {
    const bpb = this.beatsPerBar;
    return {
      bar: Math.floor(pos / bpb) + 1,
      beat: Math.floor(((pos % bpb) + bpb) % bpb) + 1,
    };
  }
}
