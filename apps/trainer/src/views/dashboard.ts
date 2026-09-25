import { practiceByDay, streakInfo, calendar, TROPHY_DAYS, records, tierReady, dueToday, COSMETICS, levelFor, totalXp } from '@midi-trainer/engine';
import type { View } from '../router';
import { el } from '../ui/dom';
import { bars, trendChart } from '../ui/charts';
import { icon } from '../ui/icons';

export const dashboardView: View = (root, app) => {
  const byDay = practiceByDay(app.attempts, app.settings.goalMinutes);
  const s = streakInfo(byDay);
  const xp = totalXp(app.attempts);
  const lv = levelFor(xp);

  const hero = el('div', { class: 'hero' });
  const tile = (label: string, big: string, hint: string, accent?: string) => {
    const c = el('div', { class: 'panel', style: accent ? `--accent:${accent}` : '' });
    c.innerHTML = `<div class="label">${label}</div><b class="big">${big}</b><p class="hint">${hint}</p>`;
    hero.appendChild(c);
    return c;
  };
  const today = tile('Today', `${Math.round(s.todayMinutes)}<small>/${app.settings.goalMinutes} min</small>`, s.todayMet ? 'Goal met.' : 'Five focused minutes beat an hour on Sunday.', 'var(--amber)');
  const tp = el('div', { class: 'progressbar' });
  tp.appendChild(el('i', { style: `width:${Math.round(Math.min(100, (100 * s.todayMinutes) / app.settings.goalMinutes))}%` }));
  today.appendChild(tp);
  tile('Streak', `${s.current}<small> day${s.current === 1 ? '' : 's'}</small>`, `Longest ${s.longest} · weekly ${s.weekly} · ${s.goalDays} goal-days`, 'var(--amber)');
  const trophy = tile('Trophies', `${s.earnedTrophies.length}<small>/${TROPHY_DAYS.length}</small>`, s.nextTrophy ? `Next at ${s.nextTrophy} goal-days` : 'All earned.', 'var(--gold)');
  if (s.nextTrophy) {
    const prev = s.earnedTrophies[s.earnedTrophies.length - 1] ?? 0;
    const p = el('div', { class: 'progressbar' });
    p.appendChild(el('i', { style: `width:${Math.round((100 * (s.goalDays - prev)) / (s.nextTrophy - prev))}%` }));
    trophy.appendChild(p);
  }
  const level = tile('Level', `${lv.level}`, `${xp.toLocaleString()} XP · ${lv.into} / ${lv.next} to level ${lv.level + 1}`, 'var(--deck-a)');
  const lp = el('div', { class: 'progressbar' });
  lp.appendChild(el('i', { style: `width:${Math.round((100 * lv.into) / lv.next)}%` }));
  level.appendChild(lp);
  root.appendChild(hero);

  const grid = el('div', { class: 'below' });
  const cal = el('div', { class: 'panel' });
  cal.appendChild(el('h2', {}, 'Practice calendar'));
  const calEl = el('div', { class: 'cal' });
  for (const col of calendar(byDay, 20)) for (const d of col) calEl.appendChild(el('i', { class: d.minutes >= app.settings.goalMinutes * 2 ? 'l3' : d.met ? 'l2' : d.minutes > 0 ? 'l1' : '', title: `${d.day}: ${Math.round(d.minutes)} min` }));
  cal.appendChild(calEl);
  cal.appendChild(el('p', { class: 'hint', style: 'margin-top:8px' }, 'Last 20 weeks, Monday to Sunday. Brighter amber is more minutes.'));
  const acc = el('div', { class: 'panel' });
  acc.appendChild(el('h2', {}, 'Accuracy by control'));
  acc.appendChild(el('p', { class: 'hint' }, 'Last 20 attempts.'));
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

  const scoreTrend = el('div', { class: 'panel', style: 'margin-top:14px' });
  scoreTrend.appendChild(el('h2', {}, 'Score across all attempts'));
  scoreTrend.appendChild(trendChart(app.attempts.slice(-60).map((a, i) => ({ x: i, y: a.score, label: `${app.drill(a.drillId)?.name ?? a.drillId} · ${a.score ?? '—'}%` }))));
  root.appendChild(scoreTrend);

  const grid2 = el('div', { class: 'below', style: 'margin-top:14px' });
  const medals = el('div', { class: 'panel' });
  medals.appendChild(el('h2', {}, 'Medal shelf'));
  const dj = app.drills.filter((d) => d.profile !== 'piano88');
  const shelf = el('div', { class: 'shelf' });
  for (const tier of ['Foundations', 'Mixing', 'Performance', 'Advanced', 'Pro']) {
    const inTier = dj.filter((d) => d.tier === tier);
    if (!inTier.length) continue;
    const golds = inTier.filter((d) => (app.best[d.id] ?? 0) >= 96).length;
    const silvers = inTier.filter((d) => (app.best[d.id] ?? 0) >= 90).length - golds;
    const bronzes = inTier.filter((d) => (app.best[d.id] ?? 0) >= 80).length - golds - silvers;
    const r = tierReady(app.attempts, dj, tier);
    const row = el('div', { class: 'tierrow' });
    row.appendChild(el('b', {}, tier));
    const m = el('span', { class: 'medals' });
    m.innerHTML = `<i class="gold"></i><span class="mono">${golds}</span><i class="silver"></i><span class="mono">${silvers}</span><i class="bronze"></i><span class="mono">${bronzes}</span>`;
    row.appendChild(m);
    row.appendChild(el('span', { class: 'mono hint' }, r.ready ? 'ready' : `${inTier.length} drills`));
    shelf.appendChild(row);
  }
  medals.appendChild(shelf);
  const albums = records(app.attempts, app.drills);
  const rec = el('div', { class: 'panel' });
  rec.appendChild(el('h2', {}, 'Records'));
  if (!albums.size) rec.appendChild(el('p', { class: 'hint' }, 'Score 96 or better on a drill to earn its record.'));
  for (const [tier, cards] of albums) {
    rec.appendChild(el('div', { class: 'label', style: 'margin-top:8px' }, `${tier} · ${cards.length}`));
    const row = el('div', { class: 'sleeves' });
    for (const c of cards) {
      const sl = el('span', { class: 'sleeve', title: new Date(c.earnedAt).toLocaleDateString() });
      sl.appendChild(icon('disc', 14));
      sl.appendChild(el('span', {}, c.name));
      row.appendChild(sl);
    }
    rec.appendChild(row);
  }
  grid2.append(medals, rec);
  root.appendChild(grid2);

  const grid3 = el('div', { class: 'below', style: 'margin-top:14px' });
  const review = el('div', { class: 'panel' });
  review.appendChild(el('h2', {}, 'Due for review'));
  const due = dueToday(app.attempts);
  if (!due.length) review.appendChild(el('p', { class: 'hint' }, 'Nothing due today.'));
  const dueRow = el('div', { class: 'row' });
  for (const r of due) {
    const d = app.drill(r.drillId);
    if (!d) continue;
    dueRow.appendChild(el('a', { href: `#/${d.profile === 'piano88' ? 'piano' : 'practice'}/${encodeURIComponent(d.id)}`, class: 'badge due' }, `${d.name} · ${r.overdueDays > 0 ? `${r.overdueDays}d late` : 'today'}`));
  }
  review.appendChild(dueRow);
  const cos = el('div', { class: 'panel' });
  cos.appendChild(el('h2', {}, 'Cosmetics'));
  cos.appendChild(el('p', { class: 'hint' }, 'Themes and lane skins unlock with levels.'));
  const cosRow = el('div', { class: 'row' });
  for (const c of COSMETICS) {
    const unlocked = lv.level >= c.level;
    const on = (c.kind === 'theme' ? app.settings.cosmeticTheme : app.settings.laneSkin) === c.id;
    const b = el('button', { class: `small${on ? ' on' : ''}` }, unlocked ? c.name : `${c.name} · L${c.level}`);
    if (!unlocked) b.disabled = true;
    b.onclick = () => void app.saveSettings(c.kind === 'theme' ? { cosmeticTheme: c.id } : { laneSkin: c.id }).then(() => {
      cosRow.querySelectorAll('button').forEach((x) => {
        const cc = COSMETICS.find((k) => x.textContent?.startsWith(k.name));
        if (cc && cc.kind === c.kind) x.classList.toggle('on', cc.id === c.id);
      });
    });
    cosRow.appendChild(b);
  }
  cos.appendChild(cosRow);
  grid3.append(review, cos);
  root.appendChild(grid3);
  const clockCard = el('div', { class: 'panel', style: 'margin-top:14px' });
  const snap = app.clock.snapshot();
  clockCard.innerHTML = `<h2>MIDI clock</h2><p class="hint">${snap.lastTickAt ? `Receiving clock: ${snap.bpm ?? '…'} BPM, ${snap.running ? 'running' : 'stopped'}. Turn on "Follow MIDI clock" in Settings to have the drill BPM track it.` : 'No MIDI clock received this session. rekordbox does not send clock by default; see docs/SYNC.md.'}</p>`;
  root.appendChild(clockCard);
};
