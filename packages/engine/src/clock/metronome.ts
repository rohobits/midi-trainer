/** Beat-tick detection across frames: returns the integer beats crossed since the last call. */
export class BeatTicker {
  private last = Number.NEGATIVE_INFINITY;

  reset(): void {
    this.last = Number.NEGATIVE_INFINITY;
  }

  /** Beats whose integer boundary was crossed since the previous call (at most `max`). */
  crossed(pos: number, max = 8): number[] {
    const tick = Math.floor(pos);
    if (this.last === Number.NEGATIVE_INFINITY) {
      this.last = tick;
      return [tick];
    }
    if (tick <= this.last) return [];
    const out: number[] = [];
    for (let b = Math.max(this.last + 1, tick - max + 1); b <= tick; b++) out.push(b);
    this.last = tick;
    return out;
  }
}
