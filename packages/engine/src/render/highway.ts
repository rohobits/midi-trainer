import type { TargetState } from '../scoring/judges/state';
import type { InputEvent } from '../scoring/attempt';
import type { Tier } from '../scoring/tiers';
import { Projection } from './projection';
import { Effects, type JudgementColors } from './effects';
import { DEFAULT_PALETTE, dimmed, mix, rgba, type LaneGroup, type LanePalette } from './palette';

export interface HighwayTheme extends LanePalette, JudgementColors {
  bg0: string;
  bg1: string;
  line: string;
  muted: string;
  euphoria: string;
  displayFont: string;
  monoFont: string;
}

export const DEFAULT_HIGHWAY_THEME: HighwayTheme = {
  ...DEFAULT_PALETTE,
  perfect: '#7cffd1',
  great: '#38d5ff',
  ok: '#ffd84d',
  miss: '#ff3d5a',
  early: '#ff8a3d',
  late: '#a98bff',
  ink: '#f3f1ea',
  bg0: '#0e1015',
  bg1: '#05060a',
  line: '#ffffff',
  muted: '#8e93a0',
  euphoria: '#7cf0ff',
  displayFont: "'Big Shoulders Variable', Impact, 'Arial Narrow', sans-serif",
  monoFont: "'JetBrains Mono Variable', ui-monospace, Menlo, monospace",
};

export interface ComboInfo {
  count: number;
  multiplier: number;
  euphoriaCharge: number;
  euphoriaActive: boolean;
  energy: number;
}

export interface HighwayFrame {
  lanes: readonly string[];
  states: readonly TargetState[];
  values: Readonly<Record<string, number>>;
  names: Readonly<Record<string, string>>;
  kinds: Readonly<Record<string, 'tap' | 'cc' | 'rel' | 'switch'>>;
  groups: Readonly<Record<string, LaneGroup>>;
  mapped: ReadonlySet<string>;
  pos: number;
  beatsPerBar: number;
  /** Beats visible above the strike line. */
  lookahead: number;
  hitWindowBeats?: number;
  /** Master mode: 0 visible → 1 hidden. */
  fade?: number;
  ghost?: readonly InputEvent[] | null;
  waiting?: { lane: string; label: string } | null;
  /** Beats until the run starts (count-in), if positive. */
  countIn?: number | null;
  combo?: ComboInfo | null;
  /** Lookahead widens to this when nothing is within `lookahead` (empty-highway fix). */
  autoWiden?: boolean;
}

export type HighwayEvent =
  | { kind: 'hit'; lane: string; tier: Tier | null; errMs: number | null; value?: number }
  | { kind: 'miss'; lane: string }
  | { kind: 'press'; lane: string; ok: boolean }
  | { kind: 'combo'; count: number }
  | { kind: 'euphoria' }
  | { kind: 'ramp'; lane: string; hit: boolean };

/**
 * The note highway. Draw order: body → lanes/grid → hit window → targets (crisp) →
 * additive pass (glows, sparks, rings, flashes) → strike line and pads → HUD text
 * (combo, count-in, waiting) → euphoria tint. Effects are timed from `now` (ms).
 */
export class HighwayRenderer {
  readonly effects = new Effects();
  private w = 0;
  private h = 0;
  private proj: Projection | null = null;
  private laneIndex = new Map<string, number>();
  private theme: HighwayTheme;
  private fov = 1.6;
  private comboScaleAt = 0;
  private euphoriaAt: number | null = null;
  private lastEuphoriaActive = false;
  private trailCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private dpr = 1;

  constructor(
    private ctx: CanvasRenderingContext2D,
    theme: Partial<HighwayTheme> = {},
  ) {
    this.theme = { ...DEFAULT_HIGHWAY_THEME, ...theme };
  }

  setTheme(theme: Partial<HighwayTheme>): void {
    this.theme = { ...DEFAULT_HIGHWAY_THEME, ...theme };
    this.effects.sprites.clear();
  }

  setReducedMotion(on: boolean): void {
    this.effects.reducedMotion = on;
  }

  setFov(fov: number): void {
    this.fov = fov;
  }

  /** CSS size; caller sets the backing store and DPR transform. */
  resize(w: number, h: number, dpr = 1): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.proj = null;
  }

  get strikeY(): number {
    return this.proj?.strikeY ?? this.h * 0.82;
  }

  laneAt(x: number): number {
    return this.proj?.laneAt(x) ?? 0;
  }

  valueAt(lane: number, x: number): number {
    return this.proj?.valueAt(lane, x) ?? 0;
  }

  laneColor(lane: string, groups: Readonly<Record<string, LaneGroup>>): string {
    return this.theme[groups[lane] ?? 'select'];
  }

  private ensureProjection(f: HighwayFrame, lookahead: number): Projection {
    const weights = f.lanes.map((l) => (f.kinds[l] === 'cc' ? 1.6 : 1));
    if (!this.proj || this.proj.laneCount !== f.lanes.length || this.proj.lookahead !== lookahead || this.proj.w !== this.w || this.proj.h !== this.h) {
      this.proj = new Projection({ width: this.w, height: this.h, lookahead, laneCount: f.lanes.length, weights, fov: this.fov });
      this.laneIndex = new Map(f.lanes.map((l, i) => [l, i]));
    }
    return this.proj;
  }

  /** Feed a gameplay event; the renderer owns the effect timing. */
  pushEvent(ev: HighwayEvent, f: Pick<HighwayFrame, 'lanes' | 'groups' | 'kinds' | 'values'>, now: number): void {
    const p = this.proj;
    if (!p) return;
    const idx = (lane: string) => this.laneIndex.get(lane) ?? -1;
    const T = this.theme;
    switch (ev.kind) {
      case 'hit': {
        const i = idx(ev.lane);
        if (i < 0) return;
        const color = this.laneColor(ev.lane, f.groups);
        const x = f.kinds[ev.lane] === 'cc' ? p.valueX(i, ev.value ?? f.values[ev.lane] ?? 0) : p.laneCentre(i);
        const y = p.strikeY;
        const j = Effects.judgement(ev.tier, ev.errMs, T);
        this.effects.ring(x, y, p.laneWidth(i) * 0.35, p.laneWidth(i) * 0.85, ev.tier === 'perfect' ? '#ffffff' : color, now);
        this.effects.spark(x, y, color, ev.tier === 'perfect' ? 10 : 6, now);
        this.effects.flash(i, color, now);
        this.effects.press(i, now);
        this.effects.popup(j.text, j.sub, x, y - 34, j.color, now);
        break;
      }
      case 'miss': {
        const i = idx(ev.lane);
        if (i < 0) return;
        this.effects.flash(i, T.miss, now, 120);
        this.effects.popup('MISS', null, p.laneCentre(i), p.strikeY - 34, T.miss, now);
        this.effects.shake(0.35, now);
        break;
      }
      case 'press': {
        const i = idx(ev.lane);
        if (i < 0) return;
        this.effects.press(i, now);
        if (!ev.ok) this.effects.flash(i, T.miss, now, 100);
        break;
      }
      case 'ramp': {
        const i = idx(ev.lane);
        if (i < 0) return;
        const color = ev.hit ? this.laneColor(ev.lane, f.groups) : T.miss;
        this.effects.flash(i, color, now, 220);
        this.effects.popup(ev.hit ? 'TRACKED' : 'DRIFTED', null, p.laneCentre(i), p.strikeY - 34, ev.hit ? T.perfect : T.miss, now);
        if (ev.hit) this.effects.spark(p.laneCentre(i), p.strikeY, color, 6, now);
        break;
      }
      case 'combo':
        this.comboScaleAt = now;
        if (ev.count > 0 && ev.count % 10 === 0) this.effects.ring(this.w / 2, p.strikeY + 26, 18, 44, T.ink, now, 300);
        break;
      case 'euphoria':
        this.euphoriaAt = now;
        this.effects.shake(0.2, now);
        break;
    }
  }

  draw(f: HighwayFrame, now: number): void {
    const { ctx } = this;
    const T = this.theme;
    const W = this.w;
    const H = this.h;
    // empty-highway fix: widen when nothing is near
    let lookahead = f.lookahead;
    if (f.autoWiden !== false) {
      let nearest = Infinity;
      for (const s of f.states) {
        if (s.kind === 'note' || s.hit || s.miss) continue;
        if ((s.kind === 'ramp' || s.kind === 'cross' || s.kind === 'jog') && s.done) continue;
        const start = s.t - f.pos;
        const end = ('t1' in s ? s.t1 : s.t) - f.pos;
        if (end < -0.2) continue;
        nearest = Math.min(nearest, Math.max(0, start));
      }
      if (nearest !== Infinity && nearest > f.lookahead) lookahead = Math.min(Math.max(f.lookahead, nearest + f.beatsPerBar), f.beatsPerBar * 8);
    }
    const p = this.ensureProjection(f, lookahead);
    const shake = this.effects.shakeOffset(now);
    const euphoria = f.combo?.euphoriaActive ?? false;
    if (euphoria && !this.lastEuphoriaActive) this.euphoriaAt = now;
    this.lastEuphoriaActive = euphoria;

    ctx.save();
    ctx.translate(shake.x, shake.y);
    // ---- body ----
    const bg = ctx.createLinearGradient(0, H, 0, 0);
    bg.addColorStop(0, T.bg0);
    bg.addColorStop(1, T.bg1);
    ctx.fillStyle = bg;
    ctx.fillRect(-8, -8, W + 16, H + 16);
    // dot field beyond the horizon, pulsing on the beat
    const beatPhase = ((f.pos % 1) + 1) % 1;
    const pulse = 1 + 0.08 * Math.max(0, 1 - beatPhase * 3);
    ctx.fillStyle = rgba(T.ink, 0.12);
    for (let i = 0; i < 40; i++) {
      const x = ((i * 97) % 1000) / 1000;
      const y = ((i * 41) % 1000) / 1000;
      const r = (0.6 + ((i * 13) % 7) / 7) * pulse;
      ctx.beginPath();
      ctx.arc(x * W, p.horizonY * 0.2 + y * p.horizonY * 0.75, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // sunburst during euphoria
    if (euphoria && this.euphoriaAt != null) {
      const k = Math.min(1, (now - this.euphoriaAt) / 433);
      const scale = 0.4 + 0.6 * Math.sin((k * Math.PI) / 2);
      const rot = this.effects.reducedMotion ? 0 : (-25 * Math.PI / 180) * ((now - this.euphoriaAt) / 1000);
      ctx.save();
      ctx.translate(W / 2, p.horizonY);
      ctx.rotate(rot);
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = T.euphoria;
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, W * 0.9 * scale, (i * Math.PI) / 6, (i * Math.PI) / 6 + Math.PI / 14);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    // ---- floor: the full runway, so a one-lane drill still sits on a stage ----
    const strike = p.strikeY;
    {
      const fg = ctx.createLinearGradient(0, strike, 0, p.horizonY);
      fg.addColorStop(0, rgba('#ffffff', 0.025));
      fg.addColorStop(1, rgba('#ffffff', 0));
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(p.floorLeft(0), strike + 6);
      ctx.lineTo(p.floorRight(0), strike + 6);
      ctx.lineTo(p.floorRight(1), p.horizonY);
      ctx.lineTo(p.floorLeft(1), p.horizonY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(T.line, 0.16);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.floorLeft(0), strike + 6);
      ctx.lineTo(p.floorLeft(1), p.horizonY);
      ctx.moveTo(p.floorRight(0), strike + 6);
      ctx.lineTo(p.floorRight(1), p.horizonY);
      ctx.stroke();
    }
    // ---- lanes ----
    for (let i = 0; i < f.lanes.length; i++) {
      const xl0 = p.laneLeft(i, 0);
      const xr0 = xl0 + p.laneWidth(i, 0);
      const xl1 = p.laneLeft(i, 1);
      const xr1 = xl1 + p.laneWidth(i, 1);
      ctx.fillStyle = rgba('#ffffff', i % 2 ? 0.05 : 0.03);
      ctx.beginPath();
      ctx.moveTo(xl0, strike + 6);
      ctx.lineTo(xr0, strike + 6);
      ctx.lineTo(xr1, p.horizonY);
      ctx.lineTo(xl1, p.horizonY);
      ctx.closePath();
      ctx.fill();
      // divider (fades toward horizon)
      const g = ctx.createLinearGradient(0, strike, 0, p.horizonY);
      g.addColorStop(0, rgba(T.line, euphoria ? 0.22 : 0.1));
      g.addColorStop(0.9, rgba(T.line, 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xr0, strike + 6);
      ctx.lineTo(xr1, p.horizonY);
      if (i === 0) {
        ctx.moveTo(xl0, strike + 6);
        ctx.lineTo(xl1, p.horizonY);
      }
      ctx.stroke();
      // centre hairline for fader lanes
      if (f.kinds[f.lanes[i]!] === 'cc') {
        ctx.strokeStyle = rgba(T.line, 0.07);
        ctx.beginPath();
        ctx.moveTo(p.laneCentre(i, 0), strike);
        ctx.lineTo(p.laneCentre(i, 1), p.horizonY);
        ctx.stroke();
      }
    }
    // ---- beat / bar / phrase grid ----
    const bpb = f.beatsPerBar;
    const phrase = bpb * 8;
    const firstBeat = Math.floor(f.pos);
    const leftAt = (t: number) => p.laneLeft(0, t);
    const rightAt = (t: number) => p.laneLeft(f.lanes.length - 1, t) + p.laneWidth(f.lanes.length - 1, t);
    for (let b = firstBeat; b <= f.pos + lookahead; b++) {
      const t = p.depth(b - f.pos);
      if (t < 0 || t > 1) continue;
      const y = p.y(t);
      const isPhrase = ((b % phrase) + phrase) % phrase === 0;
      const isBar = ((b % bpb) + bpb) % bpb === 0;
      // faint across the whole floor, brighter across the lanes
      ctx.strokeStyle = rgba(T.line, isPhrase ? 0.12 : isBar ? 0.07 : 0.03);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.floorLeft(t), y);
      ctx.lineTo(p.floorRight(t), y);
      ctx.stroke();
      ctx.strokeStyle = rgba(T.line, isPhrase ? 0.3 : isBar ? 0.18 : 0.08);
      ctx.lineWidth = isPhrase ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(leftAt(t), y);
      ctx.lineTo(rightAt(t), y);
      ctx.stroke();
      if (isBar && t > 0.02 && t < 0.95) {
        ctx.fillStyle = rgba(T.muted, isPhrase ? 0.9 : 0.5);
        ctx.font = `500 ${Math.round(10 + 2 * (1 - t))}px ${T.monoFont}`;
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.floor(b / bpb) + 1}`, leftAt(t) - 8, y + 4);
      }
    }
    // ---- hit window band ----
    if (f.hitWindowBeats) {
      const y0 = p.y(p.depth(f.hitWindowBeats));
      const y1 = p.y(p.depth(-f.hitWindowBeats));
      ctx.fillStyle = rgba(T.perfect, 0.06);
      ctx.fillRect(leftAt(0), y0, rightAt(0) - leftAt(0), y1 - y0);
      ctx.strokeStyle = rgba(T.perfect, 0.18);
      ctx.beginPath();
      ctx.moveTo(leftAt(0), y0);
      ctx.lineTo(rightAt(0), y0);
      ctx.moveTo(leftAt(0), y1);
      ctx.lineTo(rightAt(0), y1);
      ctx.stroke();
    }
    // ---- ghost path ----
    if (f.ghost) {
      ctx.strokeStyle = rgba(T.ink, 0.35);
      ctx.lineWidth = 2;
      for (let i = 0; i < f.lanes.length; i++) {
        const lane = f.lanes[i]!;
        if (f.kinds[lane] !== 'cc') continue;
        ctx.beginPath();
        let started = false;
        for (const e of f.ghost) {
          if (e.c !== lane) continue;
          const t = p.depth(e.t - f.pos);
          if (t < -0.05 || t > 1) continue;
          const x = p.valueX(i, e.v, Math.max(0, t));
          const y = p.y(t);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    // ---- targets (crisp pass) ----
    const targetAlpha = 1 - (f.fade ?? 0);
    const nearGlow: { x: number; y: number; color: string; size: number; alpha: number }[] = [];
    if (targetAlpha > 0.01) {
      for (const s of f.states) {
        if (s.kind === 'note') continue;
        const i = this.laneIndex.get(s.c);
        if (i === undefined) continue;
        const mapped = f.mapped.has(s.c);
        const base = this.laneColor(s.c, f.groups);
        const alpha = (mapped ? 1 : 0.3) * targetAlpha;
        ctx.globalAlpha = alpha;
        const color = s.hit ? T.perfect : s.miss ? dimmed(base) : euphoria ? mix(base, T.euphoria, 0.6) : base;
        switch (s.kind) {
          case 'tap': {
            const t = p.depth(s.t - f.pos);
            if (t > 1 || t < -0.12) break;
            const y = p.y(t);
            const w = p.laneWidth(i, Math.max(0, t)) * 0.78;
            const x = p.laneCentre(i, Math.max(0, t)) - w / 2;
            const hgt = Math.max(6, 14 * p.scale(Math.max(0, t)));
            const near = t >= 0 && t < 0.06 && !s.hit && !s.miss;
            ctx.fillStyle = near ? mix(color, '#ffffff', 0.2) : color;
            ctx.beginPath();
            ctx.roundRect(x, y - hgt / 2, w, hgt, hgt / 2);
            ctx.fill();
            ctx.fillStyle = rgba('#ffffff', 0.35);
            ctx.beginPath();
            ctx.roundRect(x + 3, y - hgt / 2 + 1.5, w - 6, Math.max(1.5, hgt * 0.25), 2);
            ctx.fill();
            if (t < 0.35 && !s.miss) nearGlow.push({ x: x + w / 2, y, color, size: w * 1.6, alpha: alpha * (s.hit ? 0.3 : 0.45) });
            break;
          }
          case 'cut': {
            const t = p.depth(s.t - f.pos);
            if (t > 1 || t < -0.12) break;
            const tt = Math.max(0, t);
            const y = p.y(t);
            const x0 = p.valueX(i, s.v0, tt);
            const x1 = p.valueX(i, s.v1, tt);
            const dir = Math.sign(x1 - x0) || 1;
            ctx.strokeStyle = color;
            ctx.lineWidth = 7 * p.scale(tt);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x0, y);
            ctx.lineTo(x1, y);
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x1 - dir * 10, y - 7);
            ctx.lineTo(x1, y);
            ctx.lineTo(x1 - dir * 10, y + 7);
            ctx.stroke();
            if (t < 0.35 && !s.miss) nearGlow.push({ x: x1, y, color, size: 40, alpha: alpha * 0.5 });
            break;
          }
          case 'ramp':
          case 'cross': {
            const spans: { lane: number; v0: number; v1: number }[] = s.kind === 'ramp' ? [{ lane: i, v0: s.v0, v1: s.v1 }] : [{ lane: i, v0: s.va0, v1: s.va1 }];
            if (s.kind === 'cross') {
              const j = this.laneIndex.get(s.c2);
              if (j !== undefined) spans.push({ lane: j, v0: s.vb0, v1: s.vb1 });
            }
            const t0 = p.depth(s.t - f.pos);
            const t1 = p.depth(s.t1 - f.pos);
            if (t1 < -0.12 || t0 > 1) break;
            const done = s.done;
            const col = done ? (s.hit ? T.perfect : dimmed(base)) : color;
            const isHold = s.kind === 'ramp' && s.source === 'hold';
            for (const sp of spans) {
              // sample the ribbon along depth so perspective bends it correctly
              const steps = 14;
              ctx.beginPath();
              const pts: [number, number][] = [];
              for (let k = 0; k <= steps; k++) {
                const tt = t0 + (t1 - t0) * (k / steps);
                if (tt > 1 || tt < -0.12) continue;
                const v = sp.v0 + (sp.v1 - sp.v0) * (k / steps);
                pts.push([p.valueX(sp.lane, v, Math.max(0, tt)), p.y(tt)]);
              }
              if (pts.length < 2) continue;
              // ribbon: a translucent body as wide as a fader cap, a bright rail down the
              // middle, a dashed guide so the slope reads as motion
              const mid = Math.max(0, Math.min(1, (t0 + t1) / 2));
              const bodyW = Math.min(isHold ? 30 : 24, Math.max(10, p.laneWidth(sp.lane, mid) * (isHold ? 0.16 : 0.12)));
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.beginPath();
              ctx.moveTo(pts[0]![0], pts[0]![1]);
              for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
              ctx.strokeStyle = rgba(col, done ? 0.22 : isHold ? 0.5 : 0.38);
              ctx.lineWidth = bodyW;
              ctx.stroke();
              ctx.strokeStyle = rgba(col, done ? 0.5 : 0.95);
              ctx.lineWidth = 3;
              ctx.stroke();
              ctx.strokeStyle = rgba(T.ink, 0.55);
              ctx.lineWidth = 1;
              ctx.setLineDash([5, 7]);
              ctx.lineDashOffset = this.effects.reducedMotion ? 0 : -((f.pos * 24) % 12);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.lineDashOffset = 0;
              if (!done && t0 <= 1 && t1 >= -0.12) nearGlow.push({ x: pts[Math.floor(pts.length / 2)]![0], y: pts[Math.floor(pts.length / 2)]![1], color: col, size: bodyW * 3, alpha: alpha * 0.25 });
              // end marker and value
              const end = pts[pts.length - 1]!;
              if (t1 <= 1 && t1 >= 0) {
                ctx.fillStyle = col;
                ctx.beginPath();
                ctx.arc(end[0], end[1], 6 * p.scale(Math.max(0, t1)), 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = rgba(T.ink, 0.85);
                ctx.font = `600 11px ${T.monoFont}`;
                ctx.textAlign = 'left';
                ctx.fillText(`${Math.round(sp.v1 * 100)}%`, end[0] + 7, end[1] + 4);
              }
              // live position marker while active
              if (t0 <= 0 && t1 >= 0 && !done) {
                const v = f.values[f.lanes[sp.lane]!] ?? 0;
                const expected = sp.v0 + (sp.v1 - sp.v0) * ((f.pos - s.t) / Math.max(1e-6, s.t1 - s.t));
                const ex = p.valueX(sp.lane, expected);
                ctx.strokeStyle = rgba(Math.abs(v - expected) < 0.18 ? T.perfect : T.miss, 0.9);
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(ex, strike - 10);
                ctx.lineTo(ex, strike + 10);
                ctx.stroke();
                nearGlow.push({ x: ex, y: strike, color: Math.abs(v - expected) < 0.18 ? T.perfect : T.miss, size: 36, alpha: alpha * 0.45 });
              }
            }
            break;
          }
          case 'jog': {
            const t0 = p.depth(s.t - f.pos);
            const t1 = p.depth(s.t1 - f.pos);
            if (t1 < -0.12 || t0 > 1) break;
            const segs = s.pattern.length;
            for (let k = 0; k < segs; k++) {
              const tt = t0 + (t1 - t0) * ((k + 0.5) / segs);
              if (tt > 1 || tt < -0.1) continue;
              const cx = p.laneCentre(i, Math.max(0, tt));
              const cy = p.y(tt);
              const r = 11 * p.scale(Math.max(0, tt));
              const col2 = s.done ? (s.hit ? T.perfect : dimmed(base)) : color;
              ctx.strokeStyle = col2;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(cx, cy, r, 0, Math.PI * 2);
              ctx.stroke();
              const d = s.pattern[k] === 'f' ? 1 : -1;
              const spin = this.effects.reducedMotion ? 0 : Math.sin(f.pos * Math.PI) * 0.26 * d;
              ctx.save();
              ctx.translate(cx, cy);
              ctx.rotate(spin);
              ctx.beginPath();
              ctx.moveTo(-d * 5, -5);
              ctx.lineTo(d * 3, 0);
              ctx.lineTo(-d * 5, 5);
              ctx.stroke();
              ctx.restore();
            }
            break;
          }
          case 'select': {
            const t0 = p.depth(s.t - f.pos);
            const t1 = p.depth(s.t1 - f.pos);
            if (t1 < -0.12 || t0 > 1) break;
            const ya = p.y(Math.min(1, Math.max(0, t1)));
            const yb = p.y(Math.max(-0.1, t0));
            const tt = Math.max(0, Math.min(1, t0));
            const w = p.laneWidth(i, tt) * 0.7;
            const x = p.laneCentre(i, tt) - w / 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x, ya, w, Math.max(4, yb - ya));
            ctx.setLineDash([]);
            ctx.fillStyle = rgba(color, 0.12);
            ctx.fillRect(x, ya, w, Math.max(4, yb - ya));
            ctx.fillStyle = color;
            ctx.font = `700 11px ${T.displayFont}`;
            ctx.textAlign = 'center';
            ctx.fillText('CHOOSE', x + w / 2, ya + Math.min(16, Math.max(10, (yb - ya) / 2)));
            break;
          }
        }
      }
      ctx.globalAlpha = 1;
    }
    // ---- additive pass: near-target glows, effects ----
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const g of nearGlow) {
      ctx.globalAlpha = g.alpha;
      ctx.drawImage(this.effects.sprites.glow(g.color, 64), g.x - g.size / 2, g.y - g.size / 2, g.size, g.size);
    }
    ctx.restore();
    this.effects.draw(ctx, now, (lane) => ({ x: p.laneLeft(lane, 0), w: p.laneWidth(lane, 0), top: p.horizonY, bottom: strike + 6 }), T.displayFont);
    // ---- strike line and pads ----
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = euphoria ? 0.9 : 0.55;
    ctx.drawImage(this.effects.sprites.band(euphoria ? T.euphoria : T.ink, 64, 24), leftAt(0), strike - 12, rightAt(0) - leftAt(0), 24);
    ctx.restore();
    const waitingLane = f.waiting ? this.laneIndex.get(f.waiting.lane) : undefined;
    if (f.waiting && !this.effects.reducedMotion) ctx.setLineDash([6, 6]);
    ctx.strokeStyle = rgba(T.ink, f.waiting ? 0.5 + 0.3 * Math.sin(now / 160) : 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftAt(0), strike);
    ctx.lineTo(rightAt(0), strike);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < f.lanes.length; i++) {
      const lane = f.lanes[i]!;
      const color = this.laneColor(lane, f.groups);
      const mapped = f.mapped.has(lane);
      const kind = f.kinds[lane];
      const pressed = this.effects.pressAmount(i, now);
      const lw = p.laneWidth(i);
      const cx = p.laneCentre(i);
      if (kind === 'cc') {
        const v = f.values[lane] ?? 0;
        const vx = p.valueX(i, v);
        // slot
        ctx.fillStyle = rgba('#000000', 0.5);
        ctx.beginPath();
        ctx.roundRect(p.valueX(i, 0) - 2, strike + 14, p.valueX(i, 1) - p.valueX(i, 0) + 4, 6, 3);
        ctx.fill();
        ctx.fillStyle = rgba(color, 0.7);
        ctx.beginPath();
        ctx.roundRect(p.valueX(i, 0), strike + 15, Math.max(0, vx - p.valueX(i, 0)), 4, 2);
        ctx.fill();
        // cap
        ctx.fillStyle = T.ink;
        ctx.beginPath();
        ctx.roundRect(vx - 6, strike - 9, 12, 26, 3);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.fillRect(vx - 6, strike - 1, 12, 2);
      } else if (kind === 'rel') {
        ctx.strokeStyle = rgba(color, 0.8);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, strike + 22, 13, 0, Math.PI * 2);
        ctx.stroke();
        const ang = f.values[lane] ?? 0;
        ctx.beginPath();
        ctx.moveTo(cx, strike + 22);
        ctx.lineTo(cx + 13 * Math.cos(ang - Math.PI / 2), strike + 22 + 13 * Math.sin(ang - Math.PI / 2));
        ctx.stroke();
      } else {
        const pw = lw * 0.78;
        const a = mapped ? 0.55 + 0.45 * pressed : 0.2;
        ctx.fillStyle = rgba(color, a);
        ctx.beginPath();
        ctx.roundRect(cx - pw / 2, strike + 10, pw, 12, 4);
        ctx.fill();
        ctx.strokeStyle = rgba('#000000', 0.5);
        ctx.lineWidth = 1;
        ctx.stroke();
        if (pressed > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = pressed * 0.8;
          ctx.drawImage(this.effects.sprites.glow(color, 64), cx - pw * 0.8, strike + 16 - pw * 0.8, pw * 1.6, pw * 1.6);
          ctx.restore();
        }
        if (waitingLane === i) {
          const br = 1 + 0.15 * (0.5 + 0.5 * Math.sin(now / 143));
          ctx.strokeStyle = rgba(color, 0.9);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(cx - (pw / 2) * br - 4, strike + 16 - 6 * br - 4, pw * br + 8, 12 * br + 8, 6);
          ctx.stroke();
        }
      }
      // label
      ctx.fillStyle = mapped ? rgba(T.ink, 0.85) : T.miss;
      ctx.font = `600 11px ${T.monoFont}`;
      ctx.textAlign = 'center';
      const label = (f.names[lane] ?? lane).toUpperCase() + (mapped ? '' : ' · UNMAPPED');
      ctx.fillText(label, cx, H - 12, lw - 6);
    }
    // ---- combo + multiplier ----
    if (f.combo) {
      const c = f.combo;
      const cx = W / 2;
      const cy = strike + 32;
      const k = Math.min(1, (now - this.comboScaleAt) / 120);
      const scale = 1.12 - 0.12 * k;
      if (c.count > 0) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.font = `800 40px ${T.displayFont}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = c.count % 10 === 0 ? T.ink : rgba(T.ink, 0.92);
        ctx.fillText(String(c.count), 0, 8);
        ctx.restore();
        ctx.font = `600 10px ${T.monoFont}`;
        ctx.fillStyle = rgba(T.muted, 0.9);
        ctx.fillText('COMBO', cx, cy + 22);
      }
      // 10-segment multiplier arc
      const seg = c.count % 10;
      const arcColor = c.multiplier >= 4 ? T.deckA : c.multiplier >= 3 ? T.mixer : c.multiplier >= 2 ? T.deckB : T.muted;
      for (let i = 0; i < 10; i++) {
        const a0 = Math.PI * 1.15 + (i / 10) * Math.PI * 0.7;
        const a1 = a0 + (Math.PI * 0.7) / 10 - 0.05;
        ctx.strokeStyle = i < seg || (seg === 0 && c.count > 0) ? arcColor : rgba(T.line, 0.15);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy + 4, 46, a0, a1);
        ctx.stroke();
      }
      if (c.multiplier > 1) {
        ctx.font = `800 16px ${T.displayFont}`;
        ctx.fillStyle = arcColor;
        ctx.textAlign = 'center';
        ctx.fillText(`${c.multiplier}×`, cx, cy - 40);
      }
    }
    // ---- count-in ----
    if (f.countIn != null && f.countIn > 0) {
      const n = Math.ceil(f.countIn);
      const frac = 1 - (f.countIn - Math.floor(f.countIn));
      const scale = this.effects.reducedMotion ? 1 : 1.4 - 0.4 * Math.min(1, frac * 5);
      ctx.save();
      ctx.translate(W / 2, H * 0.42);
      ctx.scale(scale, scale);
      ctx.font = `800 96px ${T.displayFont}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = T.ink;
      ctx.fillText(String(n), 0, 32);
      ctx.restore();
    }
    // ---- waiting label ----
    if (f.waiting) {
      ctx.font = `700 13px ${T.displayFont}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = rgba(T.ink, 0.9);
      ctx.fillText(f.waiting.label.toUpperCase(), W / 2, strike - 56);
    }
    // ---- euphoria tint ----
    if (euphoria) {
      ctx.fillStyle = rgba(T.euphoria, this.effects.reducedMotion ? 0.08 : 0.1 + 0.03 * Math.sin(now / 200));
      ctx.fillRect(-8, -8, W + 16, H + 16);
    }
    ctx.restore();
    void this.dpr;
    void this.trailCanvas;
  }
}
