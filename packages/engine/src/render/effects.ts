import { SpriteCache } from './sprites';
import { rgba } from './palette';
import type { Tier } from '../scoring/tiers';

/**
 * Pooled effects for the highway: sparks (struct of arrays), ring bursts, lane flashes,
 * judgement popups, pad presses and screen shake. All timing is driven by the `now` the
 * renderer passes in, so a frozen clock renders a frozen frame (visual tests).
 */
const MAX_SPARKS = 160;

export interface Popup {
  text: string;
  sub: string | null;
  x: number;
  y: number;
  color: string;
  born: number;
  life: number;
}

export interface JudgementColors {
  perfect: string;
  great: string;
  ok: string;
  miss: string;
  early: string;
  late: string;
  ink: string;
}

export class Effects {
  readonly sprites = new SpriteCache();
  reducedMotion = false;
  // sparks
  private sx = new Float32Array(MAX_SPARKS);
  private sy = new Float32Array(MAX_SPARKS);
  private svx = new Float32Array(MAX_SPARKS);
  private svy = new Float32Array(MAX_SPARKS);
  private sborn = new Float64Array(MAX_SPARKS);
  private slife = new Float32Array(MAX_SPARKS);
  private scolor: string[] = new Array(MAX_SPARKS).fill('#fff');
  private salive = new Uint8Array(MAX_SPARKS);
  private snext = 0;
  private rings: { x: number; y: number; r0: number; r1: number; color: string; born: number; life: number }[] = [];
  private flashes = new Map<number, { color: string; born: number; life: number }>();
  private presses = new Map<number, number>();
  private popups: Popup[] = [];
  private trauma = 0;
  private traumaAt = 0;
  private lastNow = 0;

  spark(x: number, y: number, color: string, count = 8, now = 0): void {
    now = Math.min(now, performance.now());
    if (this.reducedMotion) count = Math.min(count, 3);
    for (let i = 0; i < count; i++) {
      const k = this.snext;
      this.snext = (this.snext + 1) % MAX_SPARKS;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const sp = 90 + Math.random() * 160;
      this.sx[k] = x;
      this.sy[k] = y;
      this.svx[k] = Math.cos(a) * sp;
      this.svy[k] = Math.sin(a) * sp;
      this.sborn[k] = now;
      this.slife[k] = 300 + Math.random() * 120;
      this.scolor[k] = color;
      this.salive[k] = 1;
    }
  }

  ring(x: number, y: number, r0: number, r1: number, color: string, now: number, life = 220): void {
    now = Math.min(now, performance.now());
    this.rings.push({ x, y, r0, r1, color, born: now, life });
    if (this.rings.length > 24) this.rings.shift();
  }

  flash(lane: number, color: string, now: number, life = 150): void {
    now = Math.min(now, performance.now());
    this.flashes.set(lane, { color, born: now, life });
  }

  press(lane: number, now: number): void {
    now = Math.min(now, performance.now());
    this.presses.set(lane, now);
  }

  /** 0..1 how pressed a pad looks (YARG-style 250 ms cosine fade). */
  pressAmount(lane: number, now: number): number {
    const t = this.presses.get(lane);
    if (t == null) return 0;
    const k = Math.max(0, (now - t) / 250);
    if (k >= 1) {
      this.presses.delete(lane);
      return 0;
    }
    return 0.5 + 0.5 * Math.cos(Math.PI * k);
  }

  popup(text: string, sub: string | null, x: number, y: number, color: string, now: number, life = 420): void {
    now = Math.min(now, performance.now());
    // stagger popups that land on the same spot within a beat so they don't overprint
    let yy = y;
    for (const q of this.popups) if (Math.abs(q.x - x) < 30 && Math.abs(now - q.born) < 300 && Math.abs(q.y - yy) < 12) yy -= 18;
    this.popups.push({ text, sub, x, y: yy, color, born: now, life });
    if (this.popups.length > 12) this.popups.shift();
  }

  shake(amount: number, now: number): void {
    if (this.reducedMotion) return;
    this.trauma = Math.min(1, this.trauma + amount);
    this.traumaAt = now;
  }

  /** Screen offset for the frame; trauma² model, decays over ~250 ms. */
  shakeOffset(now: number): { x: number; y: number } {
    if (this.trauma <= 0) return { x: 0, y: 0 };
    const dt = now - this.traumaAt;
    const t = Math.max(0, this.trauma - dt / 250);
    if (t <= 0) {
      this.trauma = 0;
      return { x: 0, y: 0 };
    }
    const s = t * t * 6;
    return { x: (Math.sin(now * 0.09) + Math.sin(now * 0.23)) * s, y: Math.sin(now * 0.17) * s * 0.4 };
  }

  /** Judgement text and colour for a tap result. */
  static judgement(tier: Tier | null, errMs: number | null, c: JudgementColors): { text: string; sub: string | null; color: string } {
    if (tier === 'miss' || tier == null) return { text: 'MISS', sub: null, color: c.miss };
    const sub = errMs == null ? null : `${errMs > 0 ? '+' : ''}${Math.round(errMs)} ms`;
    if (tier === 'perfect') return { text: 'PERFECT', sub: Math.abs(errMs ?? 0) > 12 ? sub : null, color: c.perfect };
    if (tier === 'great') return { text: 'GREAT', sub, color: c.great };
    const early = (errMs ?? 0) < 0;
    return { text: early ? 'EARLY' : 'LATE', sub, color: early ? c.early : c.late };
  }

  /** Draw everything additive (sparks, rings, flashes) then popups. Call with the highway's ctx. */
  /**
   * `laneQuad` returns the lane's screen quad from the strike line up to a fraction of the
   * highway depth, so flashes follow the perspective instead of painting a screen rectangle.
   */
  draw(ctx: CanvasRenderingContext2D, now: number, laneQuad: (lane: number) => { x0: number; x1: number; y0: number; x2: number; x3: number; y1: number }, font: string): void {
    const dt = Math.min(0.05, this.lastNow ? (now - this.lastNow) / 1000 : 0.016);
    this.lastNow = now;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // lane flashes
    for (const [lane, f] of this.flashes) {
      const k = Math.max(0, (now - f.born) / f.life);
      if (k >= 1) {
        this.flashes.delete(lane);
        continue;
      }
      const q = laneQuad(lane);
      const g = ctx.createLinearGradient(0, q.y0, 0, q.y1);
      g.addColorStop(0, rgba(f.color, 0.22 * (1 - k)));
      g.addColorStop(1, rgba(f.color, 0));
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(q.x0, q.y0);
      ctx.lineTo(q.x1, q.y0);
      ctx.lineTo(q.x3, q.y1);
      ctx.lineTo(q.x2, q.y1);
      ctx.closePath();
      ctx.fill();
    }
    // rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]!;
      const k = Math.max(0, (now - r.born) / r.life);
      if (k >= 1) {
        this.rings.splice(i, 1);
        continue;
      }
      const e = 1 - Math.pow(1 - k, 3);
      const rad = r.r0 + (r.r1 - r.r0) * e;
      ctx.globalAlpha = 0.8 * (1 - k);
      const sprite = this.sprites.ring(r.color, 64);
      ctx.drawImage(sprite, r.x - rad, r.y - rad, rad * 2, rad * 2);
    }
    // sparks
    for (let i = 0; i < MAX_SPARKS; i++) {
      if (!this.salive[i]) continue;
      const k = Math.max(0, (now - this.sborn[i]!) / this.slife[i]!);
      if (k >= 1) {
        this.salive[i] = 0;
        continue;
      }
      this.svy[i]! += 520 * dt;
      this.sx[i]! += this.svx[i]! * dt;
      this.sy[i]! += this.svy[i]! * dt;
      ctx.globalAlpha = 1 - k;
      const s = 6 * (1 - k * 0.5);
      ctx.drawImage(this.sprites.spark(this.scolor[i]!), this.sx[i]! - s / 2, this.sy[i]! - s / 2, s, s);
    }
    ctx.restore();
    // popups (normal compositing, on top)
    ctx.save();
    ctx.textAlign = 'center';
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i]!;
      const k = Math.max(0, (now - p.born) / p.life);
      if (k >= 1) {
        this.popups.splice(i, 1);
        continue;
      }
      const rise = this.reducedMotion ? 0 : 24 * (1 - Math.pow(1 - k, 2));
      const over = k < 0.19 ? 1 + 0.15 * (1 - k / 0.19) : 1;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.font = `800 ${Math.round(22 * over)}px ${font}`;
      ctx.fillStyle = p.color;
      ctx.shadowColor = 'rgba(0,0,0,.7)';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 1;
      ctx.fillText(p.text, p.x, p.y - rise);
      if (p.sub) {
        ctx.font = `500 11px ui-monospace, Menlo, monospace`;
        ctx.fillStyle = rgba('#f3f1ea', 0.85);
        ctx.fillText(p.sub, p.x, p.y - rise + 14);
      }
    }
    ctx.restore();
  }

  get busy(): boolean {
    if (this.rings.length || this.popups.length || this.flashes.size || this.presses.size || this.trauma > 0) return true;
    for (let i = 0; i < MAX_SPARKS; i++) if (this.salive[i]) return true;
    return false;
  }

  clear(): void {
    this.salive.fill(0);
    this.rings.length = 0;
    this.flashes.clear();
    this.presses.clear();
    this.popups.length = 0;
    this.trauma = 0;
  }
}
