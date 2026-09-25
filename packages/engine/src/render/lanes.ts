import type { TargetState } from '../scoring/judges/state';
import type { Flash } from '../session/run';
import type { Theme } from './theme';

export interface LaneFrame {
  lanes: readonly string[];
  states: readonly TargetState[];
  values: Readonly<Record<string, number>>;
  flashes: Readonly<Record<string, Flash>>;
  names: Readonly<Record<string, string>>;
  kinds: Readonly<Record<string, 'tap' | 'cc'>>;
  mapped: ReadonlySet<string>;
  pos: number;
  /** Show the ±tap window band around the strike line. */
  hitWindowBeats?: number;
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
 * taps as pills, ramps as sloped paths, strike line with the live value dot.
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
  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.ppb = (h - FOOT) / 6;
  }

  draw(f: LaneFrame): void {
    const { ctx } = this;
    const C = this.theme;
    const W = this.w;
    const H = this.h;
    const PPB = this.ppb;
    ctx.clearRect(0, 0, W, H);
    const n = Math.max(f.lanes.length, 1);
    const lw = W / n;
    const strike = H - FOOT;
    f.lanes.forEach((c, i) => {
      const x = i * lw;
      ctx.fillStyle = i % 2 ? C.lane : 'transparent';
      ctx.fillRect(x, 0, lw, strike);
      ctx.strokeStyle = C.line;
      for (let b = Math.floor(f.pos); b < f.pos + 7; b++) {
        const y = strike - (b - f.pos) * PPB;
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
      const mapped = f.mapped.has(c);
      for (const t of f.states) {
        if (t.kind === 'note' || t.c !== c) continue;
        if (t.kind === 'tap') {
          const y = strike - (t.t - f.pos) * PPB;
          if (y < -10 || y > strike + 10) continue;
          ctx.fillStyle = t.hit ? C.ok : t.miss ? C.bad : C.tap;
          ctx.globalAlpha = mapped ? 1 : 0.3;
          roundRect(ctx, x + lw * 0.15, y - 7, lw * 0.7, 14, 7);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else {
          const y0 = strike - (t.t - f.pos) * PPB;
          const y1 = strike - (t.t1 - f.pos) * PPB;
          if (y1 > strike + 10 || y0 < -10) continue;
          const pad = lw * 0.12;
          const xv = (v: number) => x + pad + v * (lw - 2 * pad);
          ctx.strokeStyle = t.done ? (t.hit ? C.ok : C.bad) : C.ramp;
          ctx.lineWidth = 10;
          ctx.lineCap = 'round';
          ctx.globalAlpha = mapped ? 0.9 : 0.3;
          ctx.beginPath();
          ctx.moveTo(xv(t.v0), Math.min(y0, strike));
          ctx.lineTo(xv(t.v1), Math.max(y1, 0));
          ctx.stroke();
          ctx.globalAlpha = 1;
          if (y0 <= strike && y1 >= 0) {
            ctx.fillStyle = C.muted;
            ctx.font = `600 10px ${C.font}`;
            ctx.textAlign = 'left';
            ctx.fillText(`${Math.round(t.v1 * 100)}%`, xv(t.v1) + 8, Math.max(y1, 12) + 4);
          }
        }
      }
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, strike);
      ctx.lineTo(x + lw, strike);
      ctx.stroke();
      const fl = f.flashes[c];
      if (f.kinds[c] === 'cc') {
        const pad = lw * 0.12;
        const v = f.values[c] ?? 0;
        const cx = x + pad + v * (lw - 2 * pad);
        ctx.fillStyle = C.ink;
        ctx.beginPath();
        ctx.arc(cx, strike, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C.muted;
        ctx.fillRect(x + pad, strike + 14, lw - 2 * pad, 3);
        ctx.fillStyle = C.ramp;
        ctx.fillRect(x + pad, strike + 14, v * (lw - 2 * pad), 3);
      } else {
        ctx.fillStyle = fl ? (fl.kind === 'ok' ? C.ok : C.bad) : C.lane;
        ctx.strokeStyle = C.line;
        roundRect(ctx, x + lw * 0.25, strike + 8, lw * 0.5, 16, 5);
        ctx.fill();
        ctx.stroke();
        if (fl && fl.errMs != null) {
          ctx.fillStyle = C.ink;
          ctx.font = `700 11px ${C.font}`;
          ctx.textAlign = 'center';
          const sign = fl.errMs > 0 ? '+' : '';
          ctx.fillText(`${fl.tier ?? ''} ${sign}${Math.round(fl.errMs)}ms`.trim(), x + lw / 2, strike - 14);
        }
      }
      ctx.fillStyle = mapped ? C.ink : C.bad;
      ctx.font = `700 12px ${C.font}`;
      ctx.textAlign = 'center';
      const label = (f.names[c] ?? c) + (mapped ? '' : ' (unmapped)');
      ctx.fillText(label, x + lw / 2, H - 14, lw - 8);
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + lw, 0);
      ctx.lineTo(x + lw, H);
      ctx.stroke();
    });
  }
}
