import { Drill as DrillSchema, parseDrillFile, formatDrillError, lanesFor, lengthBeats, generateFromTemplate, TEMPLATES, type Drill, type Target } from '@midi-trainer/engine';
import type { View } from '../router';
import { navigate } from '../router';
import { confirmDialog } from '../ui/dialog';
import { el, download } from '../ui/dom';

/**
 * Drill editor: a timeline you click to add taps (or drag to add ramps) per lane, next to
 * the JSON with live validation. Saves to the browser's drill store; exports as a pack.
 */
export const editorView: View = (root, app, params) => {
  const src = params.id ? app.drill(params.id) : undefined;
  let drill: Drill = src
    ? { ...structuredClone(src), id: src.id.startsWith('custom-') ? src.id : `custom-${src.id}`, name: src.name + (src.id.startsWith('custom-') ? '' : ' (copy)'), tier: 'Custom' }
    : { id: 'custom-new-drill', version: 1, name: 'New drill', tier: 'Custom', profile: app.profile.id, bpm: 125, bars: 8, targets: [{ type: 'tap', c: 'playA', t: 0 }], lesson: '## Why\n\nExplain the technique and what correct looks like.', skills: [], genre: [], path: 'combined', level: 1 };
  const names = app.names();
  const kinds = app.kinds();

  root.appendChild(el('h2', {}, 'Drill editor'));
  const top = el('div', { class: 'rail' });
  const laneSel = el('select', { id: 'laneSel' });
  for (const c of app.profile.controls) laneSel.appendChild(el('option', { value: c.id }, c.name));
  const addLane = el('button', { class: 'small' }, 'Add lane');
  const typeSeg = el('div', { class: 'seg' });
  let tool: 'tap' | 'ramp' | 'hold' | 'cut' = 'tap';
  for (const t of ['tap', 'ramp', 'hold', 'cut'] as const) {
    const b = el('button', {}, t);
    b.classList.toggle('on', t === tool);
    b.onclick = () => {
      tool = t;
      typeSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    };
    typeSeg.appendChild(b);
  }
  const tplSel = el('select');
  tplSel.appendChild(el('option', { value: '' }, 'From template…'));
  for (const t of Object.keys(TEMPLATES)) tplSel.appendChild(el('option', { value: t }, t));
  tplSel.onchange = () => {
    if (!tplSel.value) return;
    const g = generateFromTemplate(tplSel.value, { bars: drill.bars, bpm: drill.bpm, seed: Math.floor(Math.random() * 1000) });
    drill = { ...g, id: `custom-${tplSel.value.toLowerCase()}-${Date.now() % 10000}`, tier: 'Custom' };
    tplSel.value = '';
    syncFromDrill();
  };
  const undoBtn = el('button', { class: 'small' }, 'Undo');
  top.append(el('label', {}, 'Lane'), laneSel, addLane, el('label', {}, 'Tool'), typeSeg, tplSel, undoBtn);
  root.appendChild(top);
  root.appendChild(el('p', { class: 'hint' }, 'Click a lane to place a target at the nearest quarter beat; drag horizontally on a continuous lane for a ramp or hold (start value where you press, end value where you release). Times snap to 1/4 beat. Edit the JSON on the right for anything else (compound targets, metadata); it validates as you type.'));
  const grid = el('div', { class: 'below' });
  const timelineWrap = el('div', { class: 'timeline' });
  const canvas = el('canvas');
  timelineWrap.appendChild(canvas);
  const jsonCard = el('div', { class: 'panel' });
  const ta = el('textarea', { id: 'drillJson', spellcheck: 'false' });
  const errBox = el('p', { class: 'hint', id: 'jsonErr' });
  const actions = el('div', { class: 'row' });
  const saveBtn = el('button', { class: 'primary', id: 'saveDrill' }, 'Save to my drills');
  const playBtn = el('button', {}, 'Save and practise');
  const exportBtn = el('button', {}, 'Export JSON');
  const packBtn = el('button', {}, 'Export all my drills as a pack');
  const importWrap = el('span', { class: 'file' });
  importWrap.appendChild(el('button', { type: 'button' }, 'Import drill or pack'));
  const importInput = el('input', { type: 'file', accept: '.json' });
  importWrap.appendChild(importInput);
  const delBtn = el('button', {}, 'Delete from my drills');
  actions.append(saveBtn, playBtn, exportBtn, packBtn, importWrap, delBtn);
  jsonCard.append(ta, errBox, actions);
  grid.append(timelineWrap, jsonCard);
  root.appendChild(grid);
  const list = el('div', { class: 'panel', style: 'margin-top:14px' });
  root.appendChild(list);

  const ctx = canvas.getContext('2d')!;
  const undo: Drill[] = [];
  const pushUndo = () => {
    undo.push(structuredClone(drill));
    if (undo.length > 30) undo.shift();
  };
  let W = 0;
  let H = 0;
  const LANE_H = 44;
  const LEFT = 130;

  function lanes(): string[] {
    return lanesFor(drill);
  }
  function xOf(t: number): number {
    return LEFT + (t / Math.max(lengthBeats(drill), 1)) * (W - LEFT - 10);
  }
  function tOf(x: number): number {
    return Math.round((((x - LEFT) / (W - LEFT - 10)) * Math.max(lengthBeats(drill), 1)) * 4) / 4;
  }
  function draw(): void {
    const ls = lanes();
    const dpr = window.devicePixelRatio || 1;
    W = Math.floor(timelineWrap.getBoundingClientRect().width) || 700;
    H = Math.max(120, ls.length * LANE_H + 30);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cs = getComputedStyle(document.documentElement);
    const v = (n: string) => cs.getPropertyValue(n).trim();
    ctx.clearRect(0, 0, W, H);
    ctx.font = `600 11px ${v('--font')}`;
    const total = lengthBeats(drill);
    for (let b = 0; b <= total; b++) {
      const x = xOf(b);
      ctx.strokeStyle = v('--line');
      ctx.globalAlpha = b % 4 === 0 ? 0.8 : 0.25;
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, H);
      ctx.stroke();
      if (b % 4 === 0) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = v('--muted');
        ctx.textAlign = 'left';
        ctx.fillText(`bar ${b / 4 + 1}`, x + 2, 12);
      }
    }
    ctx.globalAlpha = 1;
    ls.forEach((c, i) => {
      const y = 20 + i * LANE_H;
      ctx.fillStyle = i % 2 ? v('--lane') : 'transparent';
      ctx.fillRect(0, y, W, LANE_H);
      ctx.fillStyle = v('--ink');
      ctx.textAlign = 'left';
      ctx.fillText(names[c] ?? c, 6, y + LANE_H / 2 + 4, LEFT - 12);
    });
    const yMid = (i: number) => 20 + i * LANE_H + LANE_H / 2;
    const yVal = (i: number, val: number) => 20 + i * LANE_H + LANE_H - 6 - val * (LANE_H - 12);
    drill.targets.forEach((t, idx) => {
      const draws: Array<{ c: string; kind: string; t: number; t1?: number; v0?: number; v1?: number }> = [];
      if (t.type === 'tap' || t.type === 'cut') draws.push({ c: t.c, kind: t.type, t: t.t, ...(t.type === 'cut' ? { v0: t.v0, v1: t.v1 } : {}) });
      else if (t.type === 'ramp') draws.push({ c: t.c, kind: 'ramp', t: t.t, t1: t.t1, v0: t.v0, v1: t.v1 });
      else if (t.type === 'hold') draws.push({ c: t.c, kind: 'ramp', t: t.t, t1: t.t1, v0: t.v, v1: t.v });
      else if (t.type === 'cross') {
        draws.push({ c: t.c, kind: 'ramp', t: t.t, t1: t.t1, v0: t.va0, v1: t.va1 });
        draws.push({ c: t.c2, kind: 'ramp', t: t.t, t1: t.t1, v0: t.vb0, v1: t.vb1 });
      } else if (t.type === 'alternate') for (let k = 0; k < t.n; k++) draws.push({ c: t.c, kind: 'tap', t: t.t + k * t.step });
      else if (t.type === 'step') {
        for (let k = 0; k < t.count; k++) draws.push({ c: t.c, kind: 'tap', t: t.t + k * t.step });
        if (t.exitAt != null) draws.push({ c: t.exitC ?? t.c, kind: 'tap', t: t.exitAt });
      } else if (t.type === 'jog') draws.push({ c: t.c, kind: 'jog', t: t.t, t1: t.t1 });
      else if (t.type === 'select') draws.push({ c: t.c, kind: 'select', t: t.t, t1: t.t1 });
      else if (t.type === 'sequence') for (const s of t.steps) if ('c' in s) draws.push({ c: s.c, kind: s.type, t: t.t + s.t, t1: 't1' in s ? t.t + s.t1 : undefined });
      for (const d of draws) {
        const i = ls.indexOf(d.c);
        if (i < 0) continue;
        if (d.kind === 'tap') {
          ctx.fillStyle = v('--tap');
          ctx.beginPath();
          ctx.arc(xOf(d.t), yMid(i), 6, 0, Math.PI * 2);
          ctx.fill();
        } else if (d.kind === 'cut') {
          ctx.strokeStyle = v('--tap');
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(xOf(d.t), yVal(i, d.v0 ?? 0));
          ctx.lineTo(xOf(d.t) + 6, yVal(i, d.v1 ?? 1));
          ctx.stroke();
        } else if (d.kind === 'ramp' && d.t1 != null) {
          ctx.strokeStyle = v('--ramp');
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(xOf(d.t), yVal(i, d.v0 ?? 0));
          ctx.lineTo(xOf(d.t1), yVal(i, d.v1 ?? 0));
          ctx.stroke();
        } else if (d.t1 != null) {
          ctx.fillStyle = d.kind === 'jog' ? v('--late') : v('--muted');
          ctx.globalAlpha = 0.4;
          ctx.fillRect(xOf(d.t), yMid(i) - 10, xOf(d.t1) - xOf(d.t), 20);
          ctx.globalAlpha = 1;
        }
      }
      void idx;
    });
  }

  function syncFromDrill(): void {
    ta.value = JSON.stringify(drill, null, 2);
    validate();
    draw();
    renderList();
  }
  function validate(): boolean {
    try {
      const parsed = DrillSchema.safeParse(JSON.parse(ta.value));
      if (!parsed.success) {
        errBox.textContent = formatDrillError(parsed.error);
        errBox.style.color = 'var(--bad)';
        return false;
      }
      drill = parsed.data;
      errBox.textContent = `Valid · ${drill.targets.length} targets · ${lengthBeats(drill)} beats`;
      errBox.style.color = 'var(--ok)';
      return true;
    } catch (e) {
      errBox.textContent = 'JSON: ' + (e as Error).message;
      errBox.style.color = 'var(--bad)';
      return false;
    }
  }
  ta.oninput = () => {
    if (validate()) {
      draw();
      renderList();
    }
  };

  let drag: { lane: string; t0: number; v0: number } | null = null;
  const laneAt = (y: number) => lanes()[Math.floor((y - 20) / LANE_H)];
  canvas.onpointerdown = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const lane = laneAt(y);
    if (!lane || x < LEFT) return;
    const i = lanes().indexOf(lane);
    const val = Math.max(0, Math.min(1, 1 - (y - (20 + i * LANE_H) - 6) / (LANE_H - 12)));
    drag = { lane, t0: tOf(x), v0: Math.round(val * 20) / 20 };
    canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointerup = (e) => {
    if (!drag) return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const i = lanes().indexOf(drag.lane);
    const t1 = tOf(x);
    const val = Math.max(0, Math.min(1, 1 - (y - (20 + i * LANE_H) - 6) / (LANE_H - 12)));
    const v1 = Math.round(val * 20) / 20;
    const cont = kinds[drag.lane] === 'cc';
    pushUndo();
    let target: Target;
    if (cont && (tool === 'ramp' || tool === 'hold') && t1 > drag.t0) target = tool === 'ramp' ? { type: 'ramp', c: drag.lane, t: drag.t0, t1, v0: drag.v0, v1 } : { type: 'hold', c: drag.lane, t: drag.t0, t1, v: drag.v0 };
    else if (cont && tool === 'cut') target = { type: 'cut', c: drag.lane, t: drag.t0, v0: drag.v0, v1: v1 === drag.v0 ? 1 - drag.v0 : v1 };
    else target = { type: 'tap', c: drag.lane, t: Math.max(0, drag.t0) };
    drill.targets.push(target);
    drill.targets.sort((a, b) => a.t - b.t);
    drag = null;
    syncFromDrill();
  };
  addLane.onclick = () => {
    const c = laneSel.value;
    if (!lanes().includes(c)) {
      pushUndo();
      drill.lanes = [...lanes(), c];
      syncFromDrill();
    }
  };
  undoBtn.onclick = () => {
    const prev = undo.pop();
    if (prev) {
      drill = prev;
      syncFromDrill();
    }
  };
  function renderList(): void {
    list.innerHTML = '';
    list.appendChild(el('h2', {}, 'Targets'));
    const t = el('table');
    t.innerHTML = '<thead><tr><th>#</th><th>Type</th><th>Control</th><th>Start</th><th>End / value</th><th></th></tr></thead>';
    const tb = el('tbody');
    drill.targets.forEach((tg, i) => {
      const tr = el('tr');
      const ctrl = 'c' in tg ? names[tg.c] ?? tg.c : tg.type === 'note' ? `note ${tg.n}` : '';
      const end = 't1' in tg ? `→ ${tg.t1}` : 'v1' in tg ? `${tg.v0 ?? ''} → ${tg.v1}` : tg.type === 'alternate' ? `${tg.n} × ${tg.step}` : '';
      tr.innerHTML = `<td>${i + 1}</td><td>${tg.type}</td><td>${ctrl}</td><td>${tg.t}</td><td>${end}</td>`;
      const td = el('td');
      const del = el('button', { class: 'small' }, 'Remove');
      del.onclick = () => {
        pushUndo();
        drill.targets.splice(i, 1);
        if (!drill.targets.length) drill.targets.push({ type: 'tap', c: lanes()[0] ?? 'playA', t: 0 });
        syncFromDrill();
      };
      td.appendChild(del);
      tr.appendChild(td);
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    const tw = el('div', { class: 'tablewrap' });
    tw.appendChild(t);
    list.appendChild(tw);
  }
  saveBtn.onclick = async () => {
    if (!validate()) return;
    await app.addDrill(drill, 'custom');
    app.toast('Saved to my drills.');
  };
  playBtn.onclick = async () => {
    if (!validate()) return;
    await app.addDrill(drill, 'custom');
    navigate(`${drill.profile === 'piano88' ? 'piano' : 'practice'}/${encodeURIComponent(drill.id)}`);
  };
  exportBtn.onclick = () => {
    if (validate()) download(`${drill.id}.json`, JSON.stringify(drill, null, 2));
  };
  packBtn.onclick = () => {
    const mine = app.stored.filter((s) => s.source === 'custom' || s.source === 'imported').map((s) => s.drill);
    download(`my-drills-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 1, name: 'My drills', drills: mine.length ? mine : [drill] }, null, 2));
  };
  importInput.onchange = async () => {
    const f = importInput.files?.[0];
    if (!f) return;
    try {
      const loaded = parseDrillFile(JSON.parse(await f.text()));
      for (const d of loaded) await app.addDrill({ ...d, tier: d.tier || 'Custom' }, 'imported');
      app.toast(`Imported ${loaded.length} drill${loaded.length > 1 ? 's' : ''}.`);
      drill = loaded[0]!;
      syncFromDrill();
    } catch (e) {
      app.toast('Could not import: ' + formatDrillError(e), 5000);
    }
    importInput.value = '';
  };
  delBtn.onclick = async () => {
    if (!app.stored.some((s) => s.id === drill.id)) return app.toast('Not in my drills yet.');
    if (!(await confirmDialog(`Delete ${drill.name}?`, 'Removes it from my drills. Attempts on it stay in history.', { confirm: 'Delete', danger: true }))) return;
    await app.removeDrill(drill.id);
    app.toast('Deleted.');
  };
  const resize = () => draw();
  window.addEventListener('resize', resize);
  syncFromDrill();
  const mine = el('div', { class: 'panel', style: 'margin-top:14px' });
  mine.appendChild(el('h2', {}, 'My drills'));
  if (!app.stored.length) mine.appendChild(el('p', { class: 'hint' }, 'Nothing saved yet.'));
  for (const s of app.stored) {
    const a = el('a', { href: `#/editor/${encodeURIComponent(s.id)}`, class: 'badge' }, `${s.drill.name} · ${s.source}`);
    mine.appendChild(a);
  }
  root.appendChild(mine);
  return () => window.removeEventListener('resize', resize);
};
