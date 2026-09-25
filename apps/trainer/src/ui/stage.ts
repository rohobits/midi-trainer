import { el } from './dom';

/** The stage: HUD band on top, canvas below, overlays for count-in / waiting / perf / results. */
export interface Stage {
  root: HTMLElement;
  hud: HTMLElement;
  name: HTMLElement;
  sub: HTMLElement;
  track: HTMLElement;
  fill: HTMLElement;
  next: HTMLElement;
  score: HTMLElement;
  acc: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  msg: HTMLElement;
  perf: HTMLElement;
  results: HTMLElement;
  fit(ratio?: number): { w: number; h: number; dpr: number };
  setProgress(frac: number, ticks: { at: number; phrase: boolean }[]): void;
  destroy(): void;
}

export function createStage(host: HTMLElement, opts: { opaque?: boolean } = {}): Stage {
  const root = el('div', { class: 'stage', id: 'stage' });
  const hud = el('div', { class: 'hud' });
  const left = el('div', { style: 'min-width:0' });
  const name = el('div', { class: 'name', id: 'title' });
  const sub = el('div', { class: 'sub', id: 'barinfo' });
  left.append(name, sub);
  const track = el('div', { class: 'track' });
  const bar = el('div', { class: 'bar' });
  const fill = el('div', { class: 'fill', style: 'width:0%' });
  track.append(bar, fill);
  const next = el('div', { class: 'next', id: 'lastin' });
  const right = el('div', { style: 'text-align:right' });
  const score = el('div', { class: 'score num', id: 'hudScore' }, '—');
  const acc = el('div', { class: 'acc', id: 'hudAcc' }, '');
  right.append(score, acc);
  hud.append(left, track, next, right);
  const canvas = el('canvas', { id: 'cv' });
  const msg = el('div', { class: 'overlay-msg', id: 'cue' });
  const perf = el('div', { class: 'perfbar', id: 'perfbar' });
  const results = el('div', { class: 'results', id: 'result' });
  root.append(hud, canvas, msg, perf, results);
  host.appendChild(root);
  const ctx = canvas.getContext('2d', opts.opaque === false ? {} : { alpha: false, desynchronized: true })!;
  const fit = (ratio = 0.5) => {
    const r = root.getBoundingClientRect();
    const w = Math.floor(r.width) || 900;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const h = Math.min(640, Math.max(400, Math.round(w * ratio)));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h, dpr };
  };
  let lastTicks = '';
  const setProgress = (frac: number, ticks: { at: number; phrase: boolean }[]) => {
    fill.style.width = `${Math.max(0, Math.min(100, frac * 100))}%`;
    const key = ticks.map((t) => `${t.at.toFixed(3)}${t.phrase ? 'p' : ''}`).join(',');
    if (key !== lastTicks) {
      lastTicks = key;
      track.querySelectorAll('.tick').forEach((t) => t.remove());
      for (const t of ticks) track.appendChild(el('i', { class: `tick${t.phrase ? ' phrase' : ''}`, style: `left:${(t.at * 100).toFixed(2)}%` }));
    }
  };
  return { root, hud, name, sub, track, fill, next, score, acc, canvas, ctx, msg, perf, results, fit, setProgress, destroy: () => root.remove() };
}
