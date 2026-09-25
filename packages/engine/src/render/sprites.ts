import { rgba } from './palette';

/**
 * Pre-rendered glow sprites. Live shadowBlur re-rasterises a blur per draw call and halves
 * frame rate; a sprite is one drawImage. Cached per colour and size.
 */
type CanvasLike = HTMLCanvasElement | OffscreenCanvas;

function makeCanvas(w: number, h: number): CanvasLike {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export class SpriteCache {
  private glows = new Map<string, CanvasLike>();
  private rings = new Map<string, CanvasLike>();
  private sparks = new Map<string, CanvasLike>();

  /** Radial glow: colour at centre fading to transparent; size is the sprite edge in px. */
  glow(color: string, size: number): CanvasLike {
    const key = `${color}:${size}`;
    let c = this.glows.get(key);
    if (c) return c;
    c = makeCanvas(size, size);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, rgba(color, 0.9));
    g.addColorStop(0.35, rgba(color, 0.45));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    this.glows.set(key, c);
    return c;
  }

  /** Soft horizontal band (strike line glow, lane flash). */
  band(color: string, w: number, h: number): CanvasLike {
    const key = `band:${color}:${w}:${h}`;
    let c = this.glows.get(key);
    if (c) return c;
    c = makeCanvas(w, h);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(0.5, rgba(color, 0.55));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    this.glows.set(key, c);
    return c;
  }

  ring(color: string, size: number): CanvasLike {
    const key = `${color}:${size}`;
    let c = this.rings.get(key);
    if (c) return c;
    c = makeCanvas(size, size);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, size * 0.06);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - ctx.lineWidth, 0, Math.PI * 2);
    ctx.stroke();
    this.rings.set(key, c);
    return c;
  }

  spark(color: string): CanvasLike {
    let c = this.sparks.get(color);
    if (c) return c;
    const size = 8;
    c = makeCanvas(size, size);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    const g = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, color);
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    this.sparks.set(color, c);
    return c;
  }

  clear(): void {
    this.glows.clear();
    this.rings.clear();
    this.sparks.clear();
  }
}
