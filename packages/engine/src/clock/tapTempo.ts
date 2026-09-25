/** Tap tempo: keeps taps within `windowMs`, needs `minTaps` to report a BPM. */
export class TapTempo {
  private taps: number[] = [];
  constructor(
    private windowMs = 2500,
    private minTaps = 3,
  ) {}

  /** Register a tap at `now` (ms). Returns the BPM (rounded to 0.1) or null. */
  tap(now: number): number | null {
    this.taps = this.taps.filter((t) => now - t < this.windowMs);
    this.taps.push(now);
    if (this.taps.length < this.minTaps) return null;
    let sum = 0;
    for (let i = 1; i < this.taps.length; i++) sum += this.taps[i]! - this.taps[i - 1]!;
    const avg = sum / (this.taps.length - 1);
    return Math.round((60000 / avg) * 10) / 10;
  }

  reset(): void {
    this.taps = [];
  }
}
