import { el } from './dom';

/** The canvas stage with overlay, cue, perf bar and results box, shared by DJ and piano views. */
export interface Stage {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  title: HTMLElement;
  barinfo: HTMLElement;
  lastin: HTMLElement;
  cue: HTMLElement;
  perf: HTMLElement;
  result: HTMLElement;
  /** Fit to the parent width; returns CSS size. */
  fit(ratio?: number): { w: number; h: number };
  destroy(): void;
}

export function createStage(host: HTMLElement): Stage {
  const root = el('div', { id: 'stage' });
  const canvas = el('canvas', { id: 'cv' });
  const overlay = el('div', { class: 'overlay' });
  const left = el('div');
  const title = el('div', { class: 'big', id: 'title' });
  const barinfo = el('div', { class: 'sub', id: 'barinfo' });
  left.append(title, barinfo);
  const lastin = el('div', { class: 'sub', id: 'lastin' });
  overlay.append(left, lastin);
  const cue = el('div', { class: 'cue', id: 'cue' });
  const perf = el('div', { class: 'perfbar', id: 'perfbar' });
  const result = el('div', { class: 'result', id: 'result' });
  root.append(canvas, overlay, cue, perf, result);
  host.appendChild(root);
  const ctx = canvas.getContext('2d')!;
  const fit = (ratio = 0.45) => {
    const r = root.getBoundingClientRect();
    const w = Math.floor(r.width) || 900;
    const dpr = window.devicePixelRatio || 1;
    const h = Math.min(560, Math.max(380, Math.round(w * ratio)));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  };
  return { root, canvas, ctx, title, barinfo, lastin, cue, perf, result, fit, destroy: () => root.remove() };
}
