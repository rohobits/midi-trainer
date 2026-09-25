import type { NoteState, TargetState } from '../scoring/judges/state';
import type { NoteFlash } from '../session/noteRun';
import { PIANO_HI, PIANO_LO, NOTE_NAMES, isBlack, keyRect, keyboardMetrics, type KeyboardMetrics } from '../profiles/piano88/geometry';
import { Effects } from './effects';
import { rgba, mix, dimmed } from './palette';
import type { Tier } from '../scoring/tiers';

export interface KeyboardTheme {
  ivory: string;
  ebony: string;
  keyline: string;
  rh: string;
  lh: string;
  ok: string;
  bad: string;
  perfect: string;
  great: string;
  miss: string;
  early: string;
  late: string;
  ink: string;
  muted: string;
  line: string;
  bg0: string;
  bg1: string;
  displayFont: string;
  monoFont: string;
}

export const DEFAULT_KEYBOARD_THEME: KeyboardTheme = {
  ivory: '#f1ede3',
  ebony: '#1a1c22',
  keyline: '#d6d0c4',
  rh: '#38d5ff',
  lh: '#ffb13b',
  ok: '#7cffd1',
  bad: '#ff3d5a',
  perfect: '#7cffd1',
  great: '#38d5ff',
  miss: '#ff3d5a',
  early: '#ff8a3d',
  late: '#a98bff',
  ink: '#f3f1ea',
  muted: '#8e93a0',
  line: '#ffffff',
  bg0: '#0e1015',
  bg1: '#05060a',
  displayFont: "'Big Shoulders Variable', Impact, 'Arial Narrow', sans-serif",
  monoFont: "'JetBrains Mono Variable', ui-monospace, Menlo, monospace",
};

export interface KeyboardFrame {
  states: readonly TargetState[];
  pos: number;
  hand: 'L' | 'R' | 'B';
  pressed: ReadonlySet<number>;
  flashes: Readonly<Record<number, NoteFlash>>;
  expected: readonly NoteState[];
  fade?: number;
  waiting?: boolean;
  lookahead?: number;
}

/** Falling-notes piano renderer on the same stage-hardware language as the highway. */
export class KeyboardRenderer {
  readonly effects = new Effects();
  private w = 0;
  private h = 0;
  private m: KeyboardMetrics = { kw: 0, kh: 0, bw: 0, bh: 0, top: 0 };
  private ppb = 0;
  private theme: KeyboardTheme;

  constructor(
    private ctx: CanvasRenderingContext2D,
    theme: Partial<KeyboardTheme> = {},
  ) {
    this.theme = { ...DEFAULT_KEYBOARD_THEME, ...theme };
  }

  setTheme(theme: Partial<KeyboardTheme>): void {
    this.theme = { ...DEFAULT_KEYBOARD_THEME, ...theme };
    this.effects.sprites.clear();
  }

  setReducedMotion(on: boolean): void {
    this.effects.reducedMotion = on;
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

  /** Hit / wrong feedback on a key. */
  noteEvent(n: number, tier: Tier | null, errMs: number | null, ok: boolean, now: number): void {
    const k = keyRect(n, this.m);
    const x = k.x + k.w / 2;
    const y = this.m.top;
    const T = this.theme;
    if (ok) {
      const j = Effects.judgement(tier ?? 'perfect', errMs, T);
      this.effects.ring(x, y, 8, 26, T.perfect, now);
      this.effects.spark(x, y, tier === 'perfect' || tier == null ? T.perfect : T.great, 6, now);
      if (tier) this.effects.popup(j.text, j.sub, x, y - 26, j.color, now);
    } else {
      this.effects.popup('WRONG', null, x, y - 26, T.miss, now, 380);
      this.effects.shake(0.25, now);
    }
  }

  draw(f: KeyboardFrame, now: number): void {
    const { ctx } = this;
    const T = this.theme;
    const W = this.w;
    const H = this.h;
    const m = this.m;
    const top = m.top;
    const PPB = f.lookahead ? (H - m.kh) / f.lookahead : this.ppb;
    const shake = this.effects.shakeOffset(now);
    ctx.save();
    ctx.translate(shake.x, shake.y);
    const bg = ctx.createLinearGradient(0, top, 0, 0);
    bg.addColorStop(0, T.bg0);
    bg.addColorStop(1, T.bg1);
    ctx.fillStyle = bg;
    ctx.fillRect(-8, -8, W + 16, H + 16);
    // beat lines
    for (let b = Math.floor(f.pos); b < f.pos + (H - m.kh) / PPB + 1; b++) {
      const y = top - (b - f.pos) * PPB;
      if (y < 0) break;
      const bar = b % 4 === 0;
      ctx.strokeStyle = rgba(T.line, bar ? 0.14 : 0.06);
      ctx.lineWidth = bar ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      if (bar) {
        ctx.fillStyle = rgba(T.muted, 0.7);
        ctx.font = `500 10px ${T.monoFont}`;
        ctx.textAlign = 'left';
        ctx.fillText(`${Math.floor(b / 4) + 1}`, 6, y - 4);
      }
    }
    // falling notes
    const targetAlpha = 1 - (f.fade ?? 0);
    const glows: { x: number; y: number; color: string; size: number; alpha: number }[] = [];
    for (const n of f.states) {
      if (n.kind !== 'note') continue;
      const yb = top - (n.t - f.pos) * PPB;
      const yt = yb - n.d * PPB;
      if (yb < 0 || yt > top) continue;
      const k = keyRect(n.n, m);
      const w = k.black ? k.w : k.w * 0.86;
      const x = k.black ? k.x : k.x + (k.w - w) / 2;
      const act = f.hand === 'B' || n.hand === undefined || n.hand === f.hand;
      const base = n.hand === 'L' ? T.lh : T.rh;
      const col = n.hit ? T.perfect : n.miss ? dimmed(base) : base;
      ctx.globalAlpha = (act ? 1 : 0.28) * targetAlpha;
      const y0 = Math.max(yt, 0);
      const hgt = Math.min(yb, top) - y0 - 2;
      ctx.fillStyle = rgba(col, 0.85);
      ctx.beginPath();
      ctx.roundRect(x, y0, w, Math.max(2, hgt), 4);
      ctx.fill();
      ctx.fillStyle = rgba('#ffffff', 0.3);
      ctx.fillRect(x + 2, y0 + 1.5, w - 4, 1.5);
      if (n.d * PPB > 18 && act) {
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.font = `600 11px ${T.monoFont}`;
        ctx.textAlign = 'center';
        ctx.fillText(NOTE_NAMES[n.n % 12]!, x + w / 2, Math.min(yb, top) - 6);
      }
      if (yb > top - 40 && !n.hit && !n.miss && act) glows.push({ x: x + w / 2, y: Math.min(yb, top), color: mix(col, '#ffffff', 0.1), size: w * 2.2, alpha: 0.4 * targetAlpha });
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const g of glows) {
      ctx.globalAlpha = g.alpha;
      ctx.drawImage(this.effects.sprites.glow(g.color, 64), g.x - g.size / 2, g.y - g.size / 2, g.size, g.size);
    }
    ctx.globalAlpha = 0.5;
    ctx.drawImage(this.effects.sprites.band(T.ink, 64, 20), 0, top - 10, W, 20);
    ctx.restore();
    this.effects.draw(ctx, now, () => ({ x: 0, w: W, top: 0, bottom: top }), T.displayFont);
    // strike line
    if (f.waiting && !this.effects.reducedMotion) ctx.setLineDash([6, 6]);
    ctx.strokeStyle = rgba(T.ink, f.waiting ? 0.5 + 0.3 * Math.sin(now / 160) : 0.75);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(W, top);
    ctx.stroke();
    ctx.setLineDash([]);
    // keys
    const expected = new Map<number, 'L' | 'R' | undefined>();
    for (const n of f.expected) expected.set(n.n, n.hand);
    const drawKey = (n: number) => {
      const k = keyRect(n, m);
      let fill = k.black ? T.ebony : T.ivory;
      const fl = f.flashes[n];
      const handCol = expected.get(n) === 'L' ? T.lh : T.rh;
      if (expected.has(n)) fill = k.black ? mix(T.ebony, handCol, 0.65) : mix(T.ivory, handCol, 0.55);
      if (fl) fill = fl.kind === 'ok' ? T.perfect : T.miss;
      else if (f.pressed.has(n)) fill = expected.has(n) ? T.perfect : T.miss;
      ctx.fillStyle = fill;
      if (k.black) {
        ctx.beginPath();
        ctx.roundRect(k.x, k.y, k.w, k.h, [0, 0, 3, 3]);
        ctx.fill();
        ctx.fillStyle = rgba('#ffffff', 0.12);
        ctx.fillRect(k.x + 1, k.y, k.w - 2, 2);
      } else {
        ctx.fillRect(k.x, k.y, k.w, k.h);
        ctx.strokeStyle = T.keyline;
        ctx.lineWidth = 1;
        ctx.strokeRect(k.x + 0.5, k.y + 0.5, k.w - 1, k.h - 1);
        ctx.fillStyle = rgba('#000000', 0.08);
        ctx.fillRect(k.x, k.y + k.h - 6, k.w, 6);
        if (n % 12 === 0) {
          ctx.fillStyle = '#6a6f7b';
          ctx.font = `500 10px ${T.monoFont}`;
          ctx.textAlign = 'center';
          ctx.fillText(`C${n / 12 - 1}`, k.x + k.w / 2, H - 8);
        }
      }
      if (expected.has(n) && !this.effects.reducedMotion) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 + 0.2 * Math.sin(now / 180);
        ctx.drawImage(this.effects.sprites.glow(handCol, 64), k.x + k.w / 2 - k.w, k.y - k.w, k.w * 2, k.w * 2);
        ctx.restore();
      }
    };
    for (let n = PIANO_LO; n <= PIANO_HI; n++) if (!isBlack(n)) drawKey(n);
    for (let n = PIANO_LO; n <= PIANO_HI; n++) if (isBlack(n)) drawKey(n);
    ctx.restore();
  }
}
