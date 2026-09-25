import { practiceByDay, streakInfo, calendar, TROPHY_DAYS, records, tierReady, dueToday, COSMETICS, levelFor, totalXp } from '@midi-trainer/engine';
import type { View } from '../router';
import { el } from '../ui/dom';
import { bars, trendChart } from '../ui/charts';

export const dashboardView: View = (root, app) => {
  const byDay = practiceByDay(app.attempts, app.settings.goalMinutes);
  const s = streakInfo(byDay);
  const xp = totalXp(app.attempts);
  const lv = levelFor(xp);
  const hero = el('div', { class: 'hero' });
  const mk = (title: string, big: string, hint: string) => {
    const c = el('div', { class: 'card' });
    c.innerHTML = `<h2>${title}</h2><b class="big">${big}</b><p class="hint">${hint}</p>`;
    hero.appendChild(c);
    return c;
  };
  mk('Today', `${Math.round(s.todayMinutes)} / ${app.settings.goalMinutes} min`, s.todayMet ? 'Goal met.' : 'Five focused minutes beat an hour on Sunday.');
  mk('Streak', `${s.current} day${s.current === 1 ? '' : 's'}`, `Longest ${s.longest} · weekly streak ${s.weekly} · ${s.goalDays} goal-days total`);
  const trophy = mk('Trophies', `${s.earnedTrophies.length} / ${TROPHY_DAYS.length}`, s.nextTrophy ? `Next at ${s.nextTrophy} goal-days` : 'All earned.');
  if (s.nextTrophy) {
    const prev = s.earnedTrophies[s.earnedTrophies.length - 1] ?? 0;
    const p = el('div', { class: 'progressbar' });
    p.appendChild(el('i', { style: `width:${Math.round((100 * (s.goalDays - prev)) / (s.nextTrophy - prev))}%` }));
    trophy.appendChild(p);
  }
  const level = mk('Level', `${lv.level}`, `${xp.toLocaleString()} XP · ${lv.into} / ${lv.next} to level ${lv.level + 1}`);
  const lp = el('div', { class: 'progressbar' });
  lp.appendChild(el('i', { style: `width:${Math.round((100 * lv.into) / lv.next)}%` }));
  level.appendChild(lp);
  root.appendChild(hero);

  const grid = el('div', { class: 'below' });
  const cal = el('div', { class: 'card' });
  cal.appendChild(el('h2', {}, 'Practice calendar'));
  const calEl = el('div', { class: 'cal' });
  for (const col of calendar(byDay, 20)) for (const d of col) calEl.appendChild(el('i', { class: d.minutes >= app.settings.goalMinutes * 2 ? 'l3' : d.met ? 'l2' : d.minutes > 0 ? 'l1' : '', title: `${d.day}: ${Math.round(d.minutes)} min` }));
  cal.appendChild(calEl);
  cal.appendChild(el('p', { class: 'hint' }, 'Last 20 weeks, Monday to Sunday. Darker = more minutes.'));
  const acc = el('div', { class: 'card' });
  acc.appendChild(el('h2', {}, 'Accuracy by control type (last 20 attempts)'));
  const recent = app.attempts.slice(-20);
  const mean = (xs: (number | null | undefined)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  acc.appendChild(bars([
    { label: 'Pad timing', value: mean(recent.map((a) => a.subScores.timing)) },
    { label: 'Fader / knob tracking', value: mean(recent.map((a) => a.subScores.tracking)) },
    { label: 'Jog / selection', value: mean(recent.map((a) => a.subScores.technique)) },
    { label: 'Overall', value: mean(recent.map((a) => a.score)) },
  ]));
  const bias = recent.map((a) => a.timingMeanMs).filter((x): x is number => x != null);
  if (bias.length) acc.appendChild(el('p', { class: 'hint' }, `Mean timing error over recent runs: ${Math.round(mean(bias) ?? 0)} ms. ${Math.abs(mean(recent.map((a) => a.timingMeanMs)) ?? 0) > 25 ? 'Run the calibration wizard in Settings if this stays high.' : ''}`));
  grid.append(cal, acc);
  root.appendChild(grid);

  const scoreTrend = el('div', { class: 'card', style: 'margin-top:14px' });
  scoreTrend.appendChild(el('h2', {}, 'Score across all attempts'));
  scoreTrend.appendChild(trendChart(app.attempts.slice(-60).map((a, i) => ({ x: i, y: a.score, label: `${app.drill(a.drillId)?.name ?? a.drillId} · ${a.score ?? '—'}%` }))));
  root.appendChild(scoreTrend);

  const grid2 = el('div', { class: 'below', style: 'margin-top:14px' });
  const medals = el('div', { class: 'card' });
  medals.appendChild(el('h2', {}, 'Medals and readiness by tier'));
  const dj = app.drills.filter((d) => d.profile !== 'piano88');
  for (const tier of ['Foundations', 'Mixing', 'Performance', 'Advanced', 'Pro']) {
    const inTier = dj.filter((d) => d.tier === tier);
    if (!inTier.length) continue;
    const golds = inTier.filter((d) => (app.best[d.id] ?? 0) >= 96).length;
    const silvers = inTier.filter((d) => (app.best[d.id] ?? 0) >= 90).length - golds;
    const bronzes = inTier.filter((d) => (app.best[d.id] ?? 0) >= 80).length - golds - silvers;
    const r = tierReady(app.attempts, dj, tier);
    medals.appendChild(el('p', {}, `${tier}: ${inTier.length} drills · gold ${golds} · silver ${silvers} · bronze ${bronzes}${r.ready ? ' · ready for the next tier' : ''}`));
  }
  const albums = records(app.attempts, app.drills);
  const rec = el('div', { class: 'card' });
  rec.appendChild(el('h2', {}, 'Records (gold on a drill)'));
  if (!albums.size) rec.appendChild(el('p', { class: 'hint' }, 'Score 96 or better on a drill to earn its record.'));
  for (const [tier, cards] of albums) {
    rec.appendChild(el('h3', {}, `${tier} album · ${cards.length}`));
    const row = el('div');
    for (const c of cards) row.appendChild(el('span', { class: 'badge gold', title: new Date(c.earnedAt).toLocaleDateString() }, c.name));
    rec.appendChild(row);
  }
  grid2.append(medals, rec);
  root.appendChild(grid2);

  const grid3 = el('div', { class: 'below', style: 'margin-top:14px' });
  const review = el('div', { class: 'card' });
  review.appendChild(el('h2', {}, 'Due for review'));
  const due = dueToday(app.attempts);
  if (!due.length) review.appendChild(el('p', { class: 'hint' }, 'Nothing due today.'));
  for (const r of due) {
    const d = app.drill(r.drillId);
    if (!d) continue;
    review.appendChild(el('a', { href: `#/${d.profile === 'piano88' ? 'piano' : 'practice'}/${encodeURIComponent(d.id)}`, class: 'badge due' }, `${d.name} · ${r.overdueDays > 0 ? `${r.overdueDays}d overdue` : 'today'}`));
  }
  const cos = el('div', { class: 'card' });
  cos.appendChild(el('h2', {}, 'Cosmetics'));
  for (const c of COSMETICS) {
    const unlocked = lv.level >= c.level;
    const b = el('button', { class: `small${(c.kind === 'theme' ? app.settings.cosmeticTheme : app.settings.laneSkin) === c.id ? ' on' : ''}`, disabled: unlocked ? '' : 'disabled' }, `${c.name}${unlocked ? '' : ` (level ${c.level})`}`);
    if (unlocked) b.removeAttribute('disabled');
    b.onclick = () => void app.saveSettings(c.kind === 'theme' ? { cosmeticTheme: c.id } : { laneSkin: c.id }).then(() => cos.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b || (x.classList.contains('on') && x.textContent?.startsWith(c.kind === 'theme' ? 'zz' : 'zz')))));
    cos.appendChild(b);
    cos.appendChild(document.createTextNode(' '));
  }
  grid3.append(review, cos);
  root.appendChild(grid3);
  const clockCard = el('div', { class: 'card', style: 'margin-top:14px' });
  const snap = app.clock.snapshot();
  clockCard.innerHTML = `<h2>MIDI clock</h2><p class="hint">${snap.lastTickAt ? `Receiving clock: ${snap.bpm ?? '…'} BPM, ${snap.running ? 'running' : 'stopped'}. Turn on "Follow MIDI clock" in Settings to have the drill BPM track it.` : 'No MIDI clock received on this session. rekordbox does not send clock by default; see docs/SYNC.md for the sync investigation.'}</p>`;
  root.appendChild(clockCard);
};
