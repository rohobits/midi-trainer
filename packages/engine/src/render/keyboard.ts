import type { NoteState, TargetState } from '../scoring/judges/state';
import type { NoteFlash } from '../session/noteRun';
import { PIANO_HI, PIANO_LO, NOTE_NAMES, isBlack, keyRect, keyboardMetrics, type KeyboardMetrics } from '../profiles/piano88/geometry';
import type { Theme } from './theme';

export interface KeyboardTheme extends Theme {
  ivory: string;
  ebony: string;
  keyline: string;
  rh: string;
  lh: string;
}

export interface KeyboardFrame {
  states: readonly TargetState[];
  pos: number;
  hand: 'L' | 'R' | 'B';
  pressed: ReadonlySet<number>;
  flashes: Readonly<Record<number, NoteFlash>>;
  expected: readonly NoteState[];
  fade?: number;
}

/** Falling-notes piano renderer (prototype look). */
export class KeyboardRenderer {
  private w = 0;
  private h = 0;
  private m: KeyboardMetrics = { kw: 0, kh: 0, bw: 0, bh: 0, top: 0 };
  private ppb = 0;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private theme: KeyboardTheme,
  ) {}

  setTheme(theme: KeyboardTheme): void {
    this.theme = theme;
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.m = keyboardMetrics(w, h);
    this.ppb = (h - this.m.kh) / 4.5;
  }

  get metrics(): KeyboardMetrics {
    return this.m;
  }

  draw(f: KeyboardFrame): void {
    const { ctx } = this;
    const C = this.theme;
    const W = this.w;
    const H = this.h;
    const m = this.m;
    const top = m.top;
    const PPB = this.ppb;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = C.keyline;
    ctx.globalAlpha = 0.35;
    for (let b = Math.floor(f.pos); b < f.pos + 5; b++) {
      const y = top - (b - f.pos) * PPB;
      ctx.lineWidth = b % 4 === 0 ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const targetAlpha = 1 - (f.fade ?? 0);
    for (const n of f.states) {
      if (n.kind !== 'note') continue;
      const yb = top - (n.t - f.pos) * PPB;
      const yt = yb - n.d * PPB;
      if (yb < 0 || yt > top) continue;
      const k = keyRect(n.n, m);
      const w = k.black ? k.w : k.w * 0.86;
      const x = k.black ? k.x : k.x + (k.w - w) / 2;
      const act = f.hand === 'B' || n.hand === undefined || n.hand === f.hand;
      let col = n.hand === 'L' ? C.lh : C.rh;
      if (n.hit) col = C.ok;
      else if (n.miss) col = C.bad;
      ctx.globalAlpha = (act ? 1 : 0.28) * targetAlpha;
      ctx.fillStyle = col;
      this.roundRect(x, Math.max(yt, 0), w, Math.min(yb, top) - Math.max(yt, 0) - 2, 4);
      ctx.fill();
      if (n.d * PPB > 18 && act) {
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.font = `600 11px ${C.font}`;
        ctx.textAlign = 'center';
        ctx.fillText(NOTE_NAMES[n.n % 12]!, x + w / 2, Math.min(yb, top) - 6);
      }
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(W, top);
    ctx.stroke();
    const expected = new Map<number, 'L' | 'R' | undefined>();
    for (const n of f.expected) expected.set(n.n, n.hand);
    const drawKey = (n: number) => {
      const k = keyRect(n, m);
      let fill = k.black ? C.ebony : C.ivory;
      const fl = f.flashes[n];
      if (expected.has(n)) fill = expected.get(n) === 'L' ? C.lh : C.rh;
      if (fl) fill = fl.kind === 'ok' ? C.ok : C.bad;
      else if (f.pressed.has(n)) fill = expected.has(n) ? C.ok : C.bad;
      ctx.fillStyle = fill;
      ctx.strokeStyle = C.keyline;
      ctx.lineWidth = 1;
      if (k.black) {
        this.roundRect(k.x, k.y, k.w, k.h, 3);
        ctx.fill();
      } else {
        ctx.fillRect(k.x, k.y, k.w, k.h);
        ctx.strokeRect(k.x + 0.5, k.y + 0.5, k.w - 1, k.h - 1);
        if (n % 12 === 0) {
          ctx.fillStyle = C.muted;
          ctx.font = `500 10px ${C.font}`;
          ctx.textAlign = 'center';
          ctx.fillText(`C${n / 12 - 1}`, k.x + k.w / 2, H - 6);
        }
      }
    };
    for (let n = PIANO_LO; n <= PIANO_HI; n++) if (!isBlack(n)) drawKey(n);
    for (let n = PIANO_LO; n <= PIANO_HI; n++) if (isBlack(n)) drawKey(n);
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const { ctx } = this;
    if (h < 0) h = 0;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
