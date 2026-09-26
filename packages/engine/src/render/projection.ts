/**
 * Pseudo-3D highway projection for Canvas 2D. Depth t ∈ [0,1] runs from the strike line
 * (t = 0) to the horizon (t = 1); `a` is the foreshortening (FOV) and `taper` how much lanes
 * narrow toward the horizon. A per-row lookup is precomputed so hit tests are cheap.
 */
export interface ProjectionOptions {
  width: number;
  height: number;
  /** Fraction of height for the horizon (vanishing) line. */
  horizon?: number;
  /** Fraction of height for the strike line. */
  strike?: number;
  /** Foreshortening. 0 = linear, 1.6 = default perspective. */
  fov?: number;
  /** Lane width scale at the horizon (1 - taper). */
  taper?: number;
  /** Beats visible above the strike. */
  lookahead: number;
  laneCount: number;
  /** Optional per-lane width weights (fader lanes wider). */
  weights?: readonly number[];
}

export class Projection {
  readonly w: number;
  readonly h: number;
  readonly horizonY: number;
  readonly strikeY: number;
  readonly fov: number;
  readonly taper: number;
  readonly lookahead: number;
  readonly laneCount: number;
  private centres: number[];
  private widths: number[];
  /** Extent of the lane group at the strike line. */
  readonly groupLeft: number;
  readonly groupRight: number;

  constructor(o: ProjectionOptions) {
    this.w = o.width;
    this.h = o.height;
    this.horizonY = o.height * (o.horizon ?? 0.1);
    this.strikeY = o.height * (o.strike ?? 0.82);
    this.fov = o.fov ?? 1.6;
    this.taper = o.taper ?? 0.62;
    this.lookahead = o.lookahead;
    this.laneCount = Math.max(1, o.laneCount);
    const weights = o.weights && o.weights.length === this.laneCount ? o.weights : new Array(this.laneCount).fill(1);
    const total = weights.reduce((a, b) => a + b, 0);
    const pad = o.width * 0.04;
    const usable = o.width - 2 * pad;
    // A one- or two-lane drill must not stretch a pad across the whole screen: cap the unit
    // lane width and centre the group, so a single hot cue reads as a pad, not a runway.
    const unitCap = Math.max(72, Math.min(usable / total, Math.max(150, o.height * 0.34)));
    const groupW = unitCap * total;
    let x = pad + (usable - groupW) / 2;
    this.centres = [];
    this.widths = [];
    for (const wgt of weights) {
      const lw = unitCap * wgt;
      this.centres.push(x + lw / 2);
      this.widths.push(lw);
      x += lw;
    }
    this.groupLeft = pad + (usable - groupW) / 2;
    this.groupRight = this.groupLeft + groupW;
  }

  /** Depth for a beat offset from the current position. */
  depth(beatsAhead: number): number {
    return beatsAhead / this.lookahead;
  }

  /** Screen y for depth t (may be below strike for t < 0, past targets). */
  y(t: number): number {
    // below the strike keep the slope the curve has at t = 0, so a note crossing the line
    // neither slows nor jumps
    if (t <= 0) return this.strikeY - t * (this.strikeY - this.horizonY) * (1 + this.fov);
    const k = (t * (1 + this.fov)) / (1 + this.fov * t);
    return this.strikeY - (this.strikeY - this.horizonY) * k;
  }

  /** Scale factor at depth t (1 at strike, 1 - taper at horizon). */
  scale(t: number): number {
    const k = t <= 0 ? 0 : (t * (1 + this.fov)) / (1 + this.fov * t);
    return 1 - this.taper * Math.min(1, k);
  }

  /** Outer floor edge (full runway) at depth t, left and right. */
  floorLeft(t = 0): number {
    const cx = this.w / 2;
    return cx - (cx - this.w * 0.04) * this.scale(t);
  }
  floorRight(t = 0): number {
    const cx = this.w / 2;
    return cx + (this.w * 0.96 - cx) * this.scale(t);
  }

  laneCentre(i: number, t = 0): number {
    const cx = this.w / 2;
    return cx + ((this.centres[i] ?? cx) - cx) * this.scale(t);
  }

  laneWidth(i: number, t = 0): number {
    return (this.widths[i] ?? this.w / this.laneCount) * this.scale(t);
  }

  laneLeft(i: number, t = 0): number {
    return this.laneCentre(i, t) - this.laneWidth(i, t) / 2;
  }

  /** x for a normalised value 0..1 inside a lane (with 12% padding), at depth t. */
  valueX(i: number, v: number, t = 0): number {
    const w = this.laneWidth(i, t);
    const pad = w * 0.12;
    return this.laneLeft(i, t) + pad + v * (w - 2 * pad);
  }

  /** Lane index under a strike-line x, for on-screen input. */
  laneAt(x: number): number {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < this.laneCount; i++) {
      const d = Math.abs(x - this.laneCentre(i));
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  /** Normalised value for an x inside lane i at the strike line. */
  valueAt(i: number, x: number): number {
    const w = this.laneWidth(i);
    const pad = w * 0.12;
    return Math.max(0, Math.min(1, (x - this.laneLeft(i) - pad) / (w - 2 * pad)));
  }
}
