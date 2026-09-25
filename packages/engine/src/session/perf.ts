/**
 * Performance-mode scoring layered over the lesson score: combo multiplier (+1× per 10
 * consecutive hits to 4×), Euphoria (charged by clean 8-bar phrases, doubles while active),
 * an energy bar that fails the run in strict mode, and Clone Hero style stars from the
 * average multiplier.
 */
export interface PerfOptions {
  /** Beats per phrase for Euphoria charging. Default 32 (8 bars). */
  phraseBeats?: number;
  /** Fail when energy hits zero. Default false (no-fail). */
  strict?: boolean;
}

export interface PerfSnapshot {
  points: number;
  combo: number;
  maxCombo: number;
  multiplier: number;
  energy: number;
  euphoriaCharge: number;
  euphoriaActiveUntil: number | null;
  failed: boolean;
  stars: number;
  hits: number;
}

export class PerfState {
  points = 0;
  combo = 0;
  maxCombo = 0;
  energy = 0.5;
  euphoriaCharge = 0;
  euphoriaActiveUntil: number | null = null;
  failed = false;
  hits = 0;
  private multSum = 0;
  private multN = 0;
  private phraseClean = true;
  private phraseIndex = 0;
  private phraseBeats: number;
  private strict: boolean;

  constructor(opts: PerfOptions = {}) {
    this.phraseBeats = opts.phraseBeats ?? 32;
    this.strict = opts.strict ?? false;
  }

  get multiplier(): number {
    const base = Math.min(4, 1 + Math.floor(this.combo / 10));
    return this.euphoriaActiveUntil != null ? base * 2 : base;
  }

  /** A target settled with score 0..1 at position `pos`. */
  settle(score: number, pos: number): void {
    this.rollPhrase(pos);
    const hit = score > 0;
    if (hit) {
      this.combo++;
      this.hits++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.energy = Math.min(1, this.energy + 0.02);
    } else {
      this.combo = 0;
      this.phraseClean = false;
      this.energy = Math.max(0, this.energy - 0.05);
      if (this.strict && this.energy <= 0) this.failed = true;
    }
    const m = this.multiplier;
    this.points += Math.round(score * 100 * m);
    this.multSum += m;
    this.multN++;
  }

  /** Called every tick so Euphoria expires and phrases roll over even without targets. */
  tick(pos: number): void {
    this.rollPhrase(pos);
    if (this.euphoriaActiveUntil != null && pos >= this.euphoriaActiveUntil) this.euphoriaActiveUntil = null;
  }

  /** Spend a charge: doubles the multiplier for one phrase. Returns false if nothing charged. */
  activateEuphoria(pos: number): boolean {
    if (this.euphoriaCharge < 1 || this.euphoriaActiveUntil != null) return false;
    this.euphoriaCharge--;
    this.euphoriaActiveUntil = pos + this.phraseBeats;
    return true;
  }

  private rollPhrase(pos: number): void {
    const idx = Math.floor(pos / this.phraseBeats);
    if (idx > this.phraseIndex) {
      if (this.phraseClean && this.multN > 0) this.euphoriaCharge = Math.min(3, this.euphoriaCharge + 1);
      this.phraseClean = true;
      this.phraseIndex = idx;
    }
  }

  /** Stars from average multiplier: 1× → 3★ … ≥4.4× → 7★ (Clone Hero scale, capped at 5 here). */
  get stars(): number {
    if (!this.multN) return 0;
    const avg = this.multSum / this.multN;
    if (avg >= 4.4) return 5;
    if (avg >= 3.5) return 4;
    if (avg >= 2.5) return 3;
    if (avg >= 1.5) return 2;
    return 1;
  }

  snapshot(): PerfSnapshot {
    return {
      points: this.points, combo: this.combo, maxCombo: this.maxCombo, multiplier: this.multiplier, energy: this.energy,
      euphoriaCharge: this.euphoriaCharge, euphoriaActiveUntil: this.euphoriaActiveUntil, failed: this.failed, stars: this.stars, hits: this.hits,
    };
  }

  reset(): void {
    this.points = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.energy = 0.5;
    this.euphoriaCharge = 0;
    this.euphoriaActiveUntil = null;
    this.failed = false;
    this.hits = 0;
    this.multSum = 0;
    this.multN = 0;
    this.phraseClean = true;
    this.phraseIndex = 0;
  }
}
