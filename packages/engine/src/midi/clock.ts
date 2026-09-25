/**
 * MIDI beat clock listener (0xF8 tick at 24 ppqn, 0xFA start, 0xFB continue, 0xFC stop).
 * Reports the sender's BPM and beat phase so the trainer can measure drift against its own
 * transport, or follow it. Sync spike from the plan: measure first, lock later.
 */
export interface ClockSnapshot {
  running: boolean;
  bpm: number | null;
  /** Beats since start, fractional. */
  beat: number;
  lastTickAt: number | null;
  ticks: number;
}

export class MidiClock {
  private ticks = 0;
  private running = false;
  private times: number[] = [];
  private lastTick: number | null = null;

  /** Feed raw bytes. Returns true if the message was a clock message. */
  feed(data: ArrayLike<number>, now: number): boolean {
    const st = data[0];
    if (st === 0xf8) {
      this.ticks++;
      this.times.push(now);
      if (this.times.length > 96) this.times.shift();
      this.lastTick = now;
      return true;
    }
    if (st === 0xfa) {
      this.ticks = 0;
      this.times = [];
      this.running = true;
      return true;
    }
    if (st === 0xfb) {
      this.running = true;
      return true;
    }
    if (st === 0xfc) {
      this.running = false;
      return true;
    }
    return false;
  }

  /** BPM from the last up-to-96 tick intervals (4 beats). */
  get bpm(): number | null {
    if (this.times.length < 25) return null;
    const first = this.times[0]!;
    const last = this.times[this.times.length - 1]!;
    const perTick = (last - first) / (this.times.length - 1);
    return perTick > 0 ? Math.round((60000 / (perTick * 24)) * 10) / 10 : null;
  }

  snapshot(): ClockSnapshot {
    return { running: this.running, bpm: this.bpm, beat: this.ticks / 24, lastTickAt: this.lastTick, ticks: this.ticks };
  }

  /** Has a tick arrived in the last `ms`? */
  alive(now: number, ms = 1000): boolean {
    return this.lastTick != null && now - this.lastTick < ms;
  }

  /** Phase error between an external beat position and the trainer's, in ms, normalised to ±half a beat. */
  static driftMs(externalBeat: number, localBeat: number, bpm: number): number {
    let d = (localBeat - externalBeat) % 1;
    if (d > 0.5) d -= 1;
    if (d < -0.5) d += 1;
    return (d * 60000) / bpm;
  }
}
