import { medalFor, type AttemptRecord } from '@midi-trainer/engine';
import type { View } from '../router';
import { navigate } from '../router';
import { el } from '../ui/dom';
import { trendChart, histogram } from '../ui/charts';

export const historyView: View = (root, app, params) => {
  const drill = params.id ? app.drill(params.id) : undefined;
  if (!drill) {
    root.appendChild(el('h2', {}, 'History'));
    const list = el('div', { class: 'cards' });
    const byDrill = new Map<string, AttemptRecord[]>();
    for (const a of app.attempts) byDrill.set(a.drillId, [...(byDrill.get(a.drillId) ?? []), a]);
    for (const [id, atts] of [...byDrill].sort((a, b) => (b[1][b[1].length - 1]?.startedAt ?? 0) - (a[1][a[1].length - 1]?.startedAt ?? 0))) {
      const d = app.drill(id);
      const a = el('a', { class: 'drillcard', href: `#/history/${encodeURIComponent(id)}` });
      a.appendChild(el('div', { class: 'name' }, d?.name ?? id));
      a.appendChild(el('div', { class: 'meta' }, `${atts.length} attempts · best ${app.best[id] ?? '—'}%`));
      list.appendChild(a);
    }
    root.appendChild(list);
    if (!byDrill.size) root.appendChild(el('p', { class: 'hint' }, 'No attempts yet. Finish a drill and it shows up here.'));
    return;
  }
  const atts = app.attempts.filter((a) => a.drillId === drill.id).sort((a, b) => a.startedAt - b.startedAt);
  const top = el('div', { class: 'rail' });
  top.appendChild(el('h1', { style: 'font-size:26px' }, drill.name));
  const back = el('button', { class: 'primary' }, 'Practise');
  back.onclick = () => navigate(`${drill.profile === 'piano88' ? 'piano' : 'practice'}/${encodeURIComponent(drill.id)}`);
  top.appendChild(back);
  root.appendChild(top);
  if (!atts.length) {
    root.appendChild(el('p', { class: 'hint' }, 'No attempts yet.'));
    return;
  }
  const grid = el('div', { class: 'below' });
  const trend = el('div', { class: 'panel' });
  trend.appendChild(el('h2', {}, 'Score trend'));
  trend.appendChild(trendChart(atts.map((a, i) => ({ x: i, y: a.score, label: `${new Date(a.startedAt).toLocaleString()} · ${a.score ?? '—'}%` }))));
  const last = atts[atts.length - 1]!;
  const stats = el('div', { class: 'panel' });
  stats.innerHTML = `<h2>Summary</h2><div class="stats"><div class="stat"><b>${app.best[drill.id] ?? '—'}%</b><span>best</span></div><div class="stat"><b>${atts.length}</b><span>attempts</span></div><div class="stat"><b>${atts.filter((a) => a.passed).length}</b><span>passed</span></div><div class="stat"><b>${atts.filter((a) => a.medal === 'gold').length}</b><span>golds</span></div></div>`;
  grid.append(trend, stats);
  root.appendChild(grid);
  const errs = atts.flatMap((a) => a.perTarget.filter((p) => p.hit && p.err != null && Math.abs(p.err) <= 400 && (drill.targets.some((t) => t.type === 'tap' || t.type === 'cut' || t.type === 'alternate' || t.type === 'step' || t.type === 'sequence' || t.type === 'note'))).map((p) => p.err as number));
  const timing = el('div', { class: 'panel', style: 'margin-top:14px' });
  timing.appendChild(el('h2', {}, 'Timing distribution (all attempts)'));
  if (errs.length) {
    timing.appendChild(histogram(errs));
    const biases = atts.map((a) => a.timingMeanMs);
    timing.appendChild(el('p', { class: 'hint' }, `Latest run: mean |error| ${last.timingMeanMs ?? '—'} ms, spread ${last.timingSdMs ?? '—'} ms. Across attempts: ${biases.filter((b) => b != null).join(' → ')} ms.`));
  } else timing.appendChild(el('p', { class: 'hint' }, 'No timing data for this drill.'));
  root.appendChild(timing);
  const table = el('div', { class: 'panel', style: 'margin-top:14px' });
  table.appendChild(el('h2', {}, 'Attempts'));
  const t = el('table');
  t.innerHTML = '<thead><tr><th>When</th><th>Score</th><th>Medal</th><th>Mode</th><th>Tempo</th><th>Timing</th><th>Tiers P/G/O/M</th><th></th></tr></thead>';
  const tb = el('tbody');
  for (const a of [...atts].reverse()) {
    const tr = el('tr');
    tr.innerHTML = `<td>${new Date(a.startedAt).toLocaleString()}</td><td>${a.score ?? '—'}%</td><td class="medal-${a.medal ?? ''}">${a.medal ?? medalFor(a.score) ?? ''}</td><td>${a.mode ?? 'lesson'}${a.perf ? ` · ${a.perf.points} pts` : ''}</td><td>${Math.round((a.tempoScale ?? 1) * 100)}%</td><td>${a.timingMeanMs ?? '—'} ms</td><td>${a.tiers.perfect}/${a.tiers.great}/${a.tiers.ok}/${a.tiers.miss}</td>`;
    const td = el('td');
    if (a.id != null && drill.profile !== 'piano88') {
      const b = el('button', { class: 'small' }, 'Replay');
      b.onclick = () => navigate(`replay/${a.id}`);
      td.appendChild(b);
    }
    tr.appendChild(td);
    tb.appendChild(tr);
  }
  t.appendChild(tb);
  const tw = el('div', { class: 'tablewrap' });
  tw.appendChild(t);
  table.appendChild(tw);
  root.appendChild(table);
};
