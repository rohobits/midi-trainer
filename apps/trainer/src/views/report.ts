import { practiceByDay, streakInfo, records, type AttemptRecord } from '@midi-trainer/engine';
import type { View } from '../router';
import { el, download } from '../ui/dom';
import { bars } from '../ui/charts';

/** Printable session/teacher report for a date range, plus JSON export of the same data. */
export const reportView: View = (root, app, params) => {
  const days = Number(params.query.get('days') ?? 7);
  const since = Date.now() - days * 86400000;
  const atts = app.attempts.filter((a) => a.startedAt >= since);
  root.appendChild(el('h2', {}, `Practice report · last ${days} days`));
  const bar = el('div', { class: 'rail' });
  const seg = el('div', { class: 'seg' });
  for (const d of [7, 30, 90]) {
    const b = el('button', {}, `${d} days`);
    b.classList.toggle('on', d === days);
    b.onclick = () => {
      location.hash = `#/report?days=${d}`;
    };
    seg.appendChild(b);
  }
  const print = el('button', { class: 'primary' }, 'Print / save as PDF');
  print.onclick = () => window.print();
  const json = el('button', {}, 'Export JSON');
  json.onclick = () => download(`report-${days}d.json`, JSON.stringify({ generatedAt: Date.now(), days, attempts: atts.map(({ inputLog: _l, ...a }) => a) }, null, 2));
  bar.append(seg, print, json);
  root.appendChild(bar);
  const byDay = practiceByDay(atts, app.settings.goalMinutes);
  const s = streakInfo(practiceByDay(app.attempts, app.settings.goalMinutes));
  const minutes = [...byDay.values()].reduce((a, d) => a + d.minutes, 0);
  const hero = el('div', { class: 'hero' });
  const card = (t: string, b: string, h: string) => {
    const c = el('div', { class: 'panel' });
    c.innerHTML = `<h2>${t}</h2><b class="big">${b}</b><p class="hint">${h}</p>`;
    hero.appendChild(c);
  };
  card('Time', `${Math.round(minutes)} min`, `${byDay.size} days practised, ${[...byDay.values()].filter((d) => d.met).length} goal-days`);
  card('Attempts', String(atts.length), `${atts.filter((a) => a.passed).length} passed · ${atts.filter((a) => a.medal === 'gold').length} gold`);
  card('Streak', `${s.current} days`, `longest ${s.longest}`);
  const mean = (xs: (number | null | undefined)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  card('Average score', `${mean(atts.map((a) => a.score)) ?? '—'}%`, `timing ${mean(atts.map((a) => a.timingMeanMs)) ?? '—'} ms`);
  root.appendChild(hero);
  const acc = el('div', { class: 'panel' });
  acc.appendChild(el('h2', {}, 'Accuracy by control type'));
  acc.appendChild(bars([
    { label: 'Pad timing', value: mean(atts.map((a) => a.subScores.timing)) },
    { label: 'Tracking', value: mean(atts.map((a) => a.subScores.tracking)) },
    { label: 'Jog / selection', value: mean(atts.map((a) => a.subScores.technique)) },
  ]));
  root.appendChild(acc);
  const per = new Map<string, AttemptRecord[]>();
  for (const a of atts) per.set(a.drillId, [...(per.get(a.drillId) ?? []), a]);
  const table = el('div', { class: 'panel', style: 'margin-top:14px' });
  table.appendChild(el('h2', {}, 'By drill'));
  const t = el('table');
  t.innerHTML = '<thead><tr><th>Drill</th><th>Tier</th><th>Attempts</th><th>Best</th><th>Latest</th><th>Timing</th><th>Where it slips</th></tr></thead>';
  const tb = el('tbody');
  for (const [id, list] of [...per].sort((a, b) => b[1].length - a[1].length)) {
    const d = app.drill(id);
    const latest = list[list.length - 1]!;
    const misses = latest.perTarget.filter((p) => !p.hit).length;
    const bias = latest.timingSdMs != null && latest.timingMeanMs != null ? (latest.timingMeanMs > 60 ? 'late/early by a lot' : latest.timingSdMs > 40 ? 'inconsistent' : 'steady') : '—';
    const tr = el('tr');
    tr.innerHTML = `<td>${d?.name ?? id}</td><td>${d?.tier ?? ''}</td><td>${list.length}</td><td>${Math.max(...list.map((a) => a.score ?? 0))}%</td><td>${latest.score ?? '—'}%</td><td>${latest.timingMeanMs ?? '—'} ms</td><td>${misses} missed target${misses === 1 ? '' : 's'} · ${bias}${latest.extraPresses ? ` · ${latest.extraPresses} extra presses` : ''}</td>`;
    tb.appendChild(tr);
  }
  t.appendChild(tb);
  table.appendChild(t);
  root.appendChild(table);
  const rec = records(atts, app.drills);
  if (rec.size) {
    const r = el('div', { class: 'panel', style: 'margin-top:14px' });
    r.appendChild(el('h2', {}, 'Records earned in this period'));
    for (const [tier, cards] of rec) r.appendChild(el('p', {}, `${tier}: ${cards.map((c) => c.name).join(', ')}`));
    root.appendChild(r);
  }
  root.appendChild(el('p', { class: 'hint' }, 'Share this page as a PDF with a teacher, or export the JSON. Input logs are excluded from the export.'));
};
