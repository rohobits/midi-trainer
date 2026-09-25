import type { TargetState } from '../scoring/judges/state';
import type { Flash } from '../session/run';
import type { InputEvent } from '../scoring/attempt';
import type { Theme } from './theme';

export interface LaneFrame {
  lanes: readonly string[];
  states: readonly TargetState[];
  values: Readonly<Record<string, number>>;
  flashes: Readonly<Record<string, Flash>>;
  names: Readonly<Record<string, string>>;
  kinds: Readonly<Record<string, 'tap' | 'cc' | 'rel' | 'switch'>>;
  mapped: ReadonlySet<string>;
  pos: number;
  /** Show the ±tap window band around the strike line. */
  hitWindowBeats?: number;
  /** Master mode: 0 = targets fully visible, 1 = hidden. */
  fade?: number;
  /** Ghost: a previous attempt's input log, drawn faintly behind the live values. */
  ghost?: readonly InputEvent[] | null;
  /** Beats visible above the strike line. Default 6. */
  lookahead?: number;
}

const FOOT = 64;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  if (h < 0) h = 0;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Canvas lane renderer (prototype look): one lane per control, beat grid scrolling down,
 * taps as pills, ramps as sloped paths, cuts as arrows, crosses as paired paths, jog
 * patterns as chevrons, selects as bands, strike line with the live value dot.
 */
export class LaneRenderer {
  private w = 0;
  private h = 0;
  private ppb = 0;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private theme: Theme,
  ) {}

  setTheme(theme: Theme): void {
    this.theme = theme;
  }

  /** Size in CSS px; caller sets the backing store and DPR transform. */
  resize(w: number, h: number, lookahead = 6): void {
    this.w = w;
    this.h = h;
    this.ppb = (h - FOOT) / lookahead;
  }

  /** Lane index under an x coordinate, for on-screen input. */
  laneAt(x: number, laneCount: number): number {
    return Math.max(0, Math.min(laneCount - 1, Math.floor((x / this.w) * laneCount)));
  }

  /** Normalised value for an x coordinate inside lane `i` (matches the drawn value track). */
  valueAt(x: number, i: number, laneCount: number): number {
    const lw = this.w / laneCount;
    const pad = lw * 0.12;
    return Math.max(0, Math.min(1, (x - i * lw - pad) / (lw - 2 * pad)));
  }

  get strikeY(): number {
    return this.h - FOOT;
  }

  draw(f: LaneFrame): void {
    const { ctx } = this;
    const C = this.theme;
    const W = this.w;
    const H = this.h;
    if (f.lookahead) this.ppb = (H - FOOT) / f.lookahead;
    const PPB = this.ppb;
    ctx.clearRect(0, 0, W, H);
    const n = Math.max(f.lanes.length, 1);
    const lw = W / n;
    const strike = H - FOOT;
    const targetAlpha = 1 - (f.fade ?? 0);
    const laneIndex = new Map(f.lanes.map((c, i) => [c, i]));
    const xOf = (lane: number, v: number) => {
      const pad = lw * 0.12;
      return lane * lw + pad + v * (lw - 2 * pad);
    };
    const yOf = (t: number) => strike - (t - f.pos) * PPB;

    f.lanes.forEach((c, i) => {
      const x = i * lw;
      ctx.fillStyle = i % 2 ? C.lane : 'transparent';
      ctx.fillRect(x, 0, lw, strike);
      ctx.strokeStyle = C.line;
      for (let b = Math.floor(f.pos); b < f.pos + (H - FOOT) / PPB + 1; b++) {
        const y = yOf(b);
        ctx.globalAlpha = b % 4 === 0 ? 0.7 : 0.25;
        ctx.lineWidth = b % 4 === 0 ? 1.2 : 0.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + lw, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (f.hitWindowBeats) {
        ctx.fillStyle = C.ok;
        ctx.globalAlpha = 0.08;
        ctx.fillRect(x, strike - f.hitWindowBeats * PPB, lw, 2 * f.hitWindowBeats * PPB);
        ctx.globalAlpha = 1;
      }
      // ghost path for continuous lanes
      if (f.ghost && f.kinds[c] === 'cc') {
        ctx.strokeStyle = C.muted;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 2;
        ctx.beginPath();
        let started = false;
        for (const e of f.ghost) {
          if (e.c !== c) continue;
          const y = yOf(e.t);
          if (y < -10 || y > strike + 10) continue;
          const gx = xOf(i, e.v);
          if (!started) {
            ctx.moveTo(gx, y);
            started = true;
          } else ctx.lineTo(gx, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });

    // targets
    for (const t of f.states) {
      if (t.kind === 'note') continue;
      const li = laneIndex.get(t.c);
      if (li === undefined) continue;
      const mapped = f.mapped.has(t.c);
      const alpha = (mapped ? 1 : 0.3) * targetAlpha;
      if (alpha <= 0.01) continue;
      const x = li * lw;
      switch (t.kind) {
        case 'tap': {
          const y = yOf(t.t);
          if (y < -10 || y > strike + 10) break;
          ctx.fillStyle = t.hit ? C.ok : t.miss ? C.bad : C.tap;
          ctx.globalAlpha = alpha;
          roundRect(ctx, x + lw * 0.15, y - 7, lw * 0.7, 14, 7);
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'cut': {
          const y = yOf(t.t);
          if (y < -10 || y > strike + 10) break;
          ctx.strokeStyle = t.hit ? C.ok : t.miss ? C.bad : C.tap;
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.globalAlpha = alpha;
          const x0 = xOf(li, t.v0);
          const x1 = xOf(li, t.v1);
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.lineTo(x1, y);
          ctx.stroke();
          const dir = Math.sign(x1 - x0) || 1;
          ctx.beginPath();
          ctx.moveTo(x1, y);
          ctx.lineTo(x1 - dir * 8, y - 6);
          ctx.moveTo(x1, y);
          ctx.lineTo(x1 - dir * 8, y + 6);
          ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 'ramp': {
          this.path(li, t.t, t.t1, t.v0, t.v1, t.done ? (t.hit ? C.ok : C.bad) : C.ramp, alpha, lw, strike, xOf, yOf);
          break;
        }
        case 'cross': {
          const col = t.done ? (t.hit ? C.ok : C.bad) : C.ramp;
          this.path(li, t.t, t.t1, t.va0, t.va1, col, alpha, lw, strike, xOf, yOf);
          const l2 = laneIndex.get(t.c2);
          if (l2 !== undefined) this.path(l2, t.t, t.t1, t.vb0, t.vb1, col, alpha, lw, strike, xOf, yOf);
          break;
        }
        case 'jog': {
          const y0 = yOf(t.t);
          const y1 = yOf(t.t1);
          if (y1 > strike + 10 || y0 < -10) break;
          const segs = t.pattern.length;
          const segH = (y0 - y1) / segs;
          ctx.strokeStyle = t.done ? (t.hit ? C.ok : C.bad) : C.tap;
          ctx.lineWidth = 3;
          ctx.globalAlpha = alpha;
          t.pattern.forEach((p, k) => {
            const cy = y0 - (k + 0.5) * segH;
            const cx = x + lw / 2;
            const d = p === 'f' ? 1 : -1;
            ctx.beginPath();
            ctx.moveTo(cx - d * 10, cy - 6);
            ctx.lineTo(cx + d * 6, cy);
            ctx.lineTo(cx - d * 10, cy + 6);
            ctx.stroke();
          });
          ctx.globalAlpha = 1;
          break;
        }
        case 'select': {
          const y0 = yOf(t.t);
          const y1 = yOf(t.t1);
          if (y1 > strike + 10 || y0 < -10) break;
          ctx.fillStyle = t.hit ? C.ok : t.miss ? C.bad : C.tap;
          ctx.globalAlpha = alpha * 0.35;
          ctx.fillRect(x + lw * 0.1, Math.max(y1, 0), lw * 0.8, Math.min(y0, strike) - Math.max(y1, 0));
          ctx.globalAlpha = 1;
          break;
        }
      }
    }

    // strike line, live value, labels
    f.lanes.forEach((c, i) => {
      const x = i * lw;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, strike);
      ctx.lineTo(x + lw, strike);
      ctx.stroke();
      const fl = f.flashes[c];
      const kind = f.kinds[c];
      if (kind === 'cc') {
        const pad = lw * 0.12;
        const v = f.values[c] ?? 0;
        const cx = xOf(i, v);
        ctx.fillStyle = C.ink;
        ctx.beginPath();
        ctx.arc(cx, strike, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C.muted;
        ctx.fillRect(x + pad, strike + 14, lw - 2 * pad, 3);
        ctx.fillStyle = C.ramp;
        ctx.fillRect(x + pad, strike + 14, v * (lw - 2 * pad), 3);
      } else if (kind === 'rel') {
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + lw / 2, strike + 22, 12, 0, Math.PI * 2);
        ctx.stroke();
        const v = f.values[c] ?? 0;
        ctx.beginPath();
        ctx.moveTo(x + lw / 2, strike + 22);
        ctx.lineTo(x + lw / 2 + 12 * Math.cos(v), strike + 22 + 12 * Math.sin(v));
        ctx.stroke();
      } else {
        ctx.fillStyle = fl ? (fl.kind === 'ok' ? C.ok : C.bad) : C.lane;
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 1;
        roundRect(ctx, x + lw * 0.25, strike + 8, lw * 0.5, 16, 5);
        ctx.fill();
        ctx.stroke();
      }
      if (fl && fl.errMs != null) {
        ctx.fillStyle = fl.errMs < -10 ? C.early : fl.errMs > 10 ? C.late : C.ok;
        ctx.font = `700 11px ${C.font}`;
        ctx.textAlign = 'center';
        const sign = fl.errMs > 0 ? '+' : '';
        ctx.fillText(`${fl.tier ?? ''} ${sign}${Math.round(fl.errMs)}ms`.trim(), x + lw / 2, strike - 14);
      }
      const mapped = f.mapped.has(c);
      ctx.fillStyle = mapped ? C.ink : C.bad;
      ctx.font = `700 12px ${C.font}`;
      ctx.textAlign = 'center';
      ctx.fillText((f.names[c] ?? c) + (mapped ? '' : ' (unmapped)'), x + lw / 2, H - 14, lw - 8);
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + lw, 0);
      ctx.lineTo(x + lw, H);
      ctx.stroke();
    });
  }

  private path(
    lane: number, t: number, t1: number, v0: number, v1: number, color: string, alpha: number, lw: number, strike: number,
    xOf: (lane: number, v: number) => number, yOf: (t: number) => number,
  ): void {
    const { ctx } = this;
    const C = this.theme;
    const y0 = yOf(t);
    const y1 = yOf(t1);
    if (y1 > strike + 10 || y0 < -10) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.globalAlpha = alpha * 0.9;
    ctx.beginPath();
    // clip the segment to the visible band so the slope stays true
    const clip = (yy: number) => Math.max(0, Math.min(strike, yy));
    const k0 = y0 > strike ? (y0 - strike) / (y0 - y1) : 0;
    const k1 = y1 < 0 ? (y0 - 0) / (y0 - y1) : 1;
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
    ctx.moveTo(xOf(lane, lerp(v0, v1, k0)), clip(y0));
    ctx.lineTo(xOf(lane, lerp(v0, v1, k1)), clip(y1));
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (y0 <= strike && y1 >= 0) {
      ctx.fillStyle = C.muted;
      ctx.font = `600 10px ${C.font}`;
      ctx.textAlign = 'left';
      ctx.fillText(`${Math.round(v1 * 100)}%`, xOf(lane, v1) + 8, Math.max(y1, 12) + 4);
    }
    void lw;
  }
}
