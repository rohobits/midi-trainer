/** Small inline-SVG charts, theme-aware via CSS variables. */
const NS = 'http://www.w3.org/2000/svg';

function svg(w: number, h: number): SVGSVGElement {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', `0 0 ${w} ${h}`);
  s.setAttribute('class', 'chart');
  s.setAttribute('role', 'img');
  return s;
}

function node(name: string, attrs: Record<string, string | number>): SVGElement {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}

/** Score trend: points over attempts with medal lines. */
export function trendChart(points: { x: number; y: number | null; label?: string }[], opts: { min?: number; max?: number; lines?: number[] } = {}): SVGSVGElement {
  const W = 600;
  const H = 180;
  const P = 28;
  const s = svg(W, H);
  const min = opts.min ?? 0;
  const max = opts.max ?? 100;
  const n = Math.max(points.length, 2);
  const x = (i: number) => P + (i * (W - 2 * P)) / (n - 1);
  const y = (v: number) => H - P - ((v - min) * (H - 2 * P)) / (max - min);
  for (const v of opts.lines ?? [80, 90, 96]) {
    s.appendChild(node('line', { x1: P, x2: W - P, y1: y(v), y2: y(v), stroke: 'var(--line)', 'stroke-dasharray': '4 4' }));
    const t = node('text', { x: W - P + 4, y: y(v) + 4, fill: 'var(--muted)', 'font-size': 10 });
    t.textContent = String(v);
    s.appendChild(t);
  }
  let d = '';
  points.forEach((p, i) => {
    if (p.y == null) return;
    d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)} `;
  });
  s.appendChild(node('path', { d, fill: 'none', stroke: 'var(--ramp)', 'stroke-width': 2 }));
  points.forEach((p, i) => {
    if (p.y == null) return;
    const c = node('circle', { cx: x(i), cy: y(p.y), r: 3.5, fill: p.y >= 96 ? 'var(--gold)' : p.y >= 80 ? 'var(--ok)' : 'var(--muted)' });
    if (p.label) {
      const t = document.createElementNS(NS, 'title');
      t.textContent = p.label;
      c.appendChild(t);
    }
    s.appendChild(c);
  });
  return s;
}

/** Histogram of signed timing errors in ms. */
export function histogram(values: number[], opts: { bucketMs?: number; rangeMs?: number } = {}): SVGSVGElement {
  const W = 600;
  const H = 150;
  const P = 24;
  const bucket = opts.bucketMs ?? 20;
  const range = opts.rangeMs ?? 160;
  const s = svg(W, H);
  const nb = Math.ceil((2 * range) / bucket);
  const counts = new Array(nb).fill(0) as number[];
  for (const v of values) {
    const i = Math.min(nb - 1, Math.max(0, Math.floor((v + range) / bucket)));
    counts[i]!++;
  }
  const maxC = Math.max(1, ...counts);
  const bw = (W - 2 * P) / nb;
  counts.forEach((c, i) => {
    const h = ((H - 2 * P) * c) / maxC;
    const centre = -range + (i + 0.5) * bucket;
    const fill = Math.abs(centre) <= 40 ? 'var(--ok)' : Math.abs(centre) <= 90 ? 'var(--ramp)' : Math.abs(centre) <= 140 ? 'var(--tap)' : 'var(--bad)';
    s.appendChild(node('rect', { x: P + i * bw + 1, y: H - P - h, width: Math.max(1, bw - 2), height: h, fill, opacity: 0.85 }));
  });
  s.appendChild(node('line', { x1: W / 2, x2: W / 2, y1: P, y2: H - P, stroke: 'var(--ink)', 'stroke-width': 1 }));
  for (const [v, label] of [[-range, `−${range} early`], [0, '0'], [range, `+${range} late`]] as const) {
    const t = node('text', { x: P + ((v + range) / (2 * range)) * (W - 2 * P), y: H - 6, fill: 'var(--muted)', 'font-size': 10, 'text-anchor': 'middle' });
    t.textContent = label;
    s.appendChild(t);
  }
  return s;
}

/** Simple horizontal bars, e.g. accuracy by control type. */
export function bars(rows: { label: string; value: number | null; max?: number }[]): SVGSVGElement {
  const W = 600;
  const rowH = 26;
  const H = rows.length * rowH + 8;
  const s = svg(W, H);
  rows.forEach((r, i) => {
    const y = 4 + i * rowH;
    const t = node('text', { x: 0, y: y + 16, fill: 'var(--ink)', 'font-size': 12 });
    t.textContent = r.label;
    s.appendChild(t);
    s.appendChild(node('rect', { x: 180, y: y + 6, width: W - 180 - 50, height: 12, fill: 'var(--line)', rx: 6 }));
    if (r.value != null) {
      const w = ((W - 180 - 50) * r.value) / (r.max ?? 100);
      s.appendChild(node('rect', { x: 180, y: y + 6, width: Math.max(0, w), height: 12, fill: r.value >= 80 ? 'var(--ok)' : 'var(--tap)', rx: 6 }));
    }
    const v = node('text', { x: W - 44, y: y + 16, fill: 'var(--muted)', 'font-size': 12 });
    v.textContent = r.value == null ? '—' : `${Math.round(r.value)}`;
    s.appendChild(v);
  });
  return s;
}
