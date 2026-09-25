import { availability, dueToday, dailyChallenge, practiceByDay, streakInfo, generateFromTemplate, TEMPLATES, hashString, dayKey, tierReady, type Drill } from '@midi-trainer/engine';
import type { View } from '../router';
import { navigate } from '../router';
import { paths, genres, tierRank } from '../content';
import { el } from '../ui/dom';

export const browseView: View = (root, app, params) => {
  const profileFilter = params.query.get('profile') ?? 'flx4';
  const isPiano = profileFilter === 'piano88';
  let mapped = app.mapped();
  const caps = new Set(app.profile.capabilities);
  const filters = { skill: '', genre: '', control: '', tier: '', text: '', available: false };

  const hero = el('div', { class: 'hero' });
  // Daily challenge
  const daily = dailyChallenge(app.drills, dayKey());
  const dailyCard = el('div', { class: 'card' });
  const dailyBest = app.best[daily.drill.id];
  dailyCard.innerHTML = `<h2>Daily challenge</h2><b class="big">${daily.drill.name.replace('Daily · ', '')}</b><p class="hint">${daily.twist}${dailyBest != null ? ` · your best today ${dailyBest}%` : ''}</p>`;
  const dailyBtn = el('button', { class: 'primary', id: 'dailyBtn' }, 'Play today');
  dailyBtn.onclick = async () => {
    await app.addDrill(daily.drill, 'daily');
    navigate(`practice/${encodeURIComponent(daily.drill.id)}`);
  };
  dailyCard.appendChild(dailyBtn);
  // Review queue
  const due = dueToday(app.attempts);
  const reviewCard = el('div', { class: 'card' });
  reviewCard.innerHTML = `<h2>Due for review</h2><b class="big">${due.length}</b><p class="hint">${due.length ? 'Passed drills come back on an expanding schedule: 1, 3, 7, 14, 30, 60 days.' : 'Nothing due. Pass a drill and it returns tomorrow.'}</p>`;
  const reviewList = el('div');
  for (const r of due.slice(0, 4)) {
    const d = app.drill(r.drillId);
    if (!d) continue;
    const a = el('a', { href: `#/${d.profile === 'piano88' ? 'piano' : 'practice'}/${encodeURIComponent(d.id)}`, class: 'badge due' }, `${d.name}${r.overdueDays > 0 ? ` · ${r.overdueDays}d overdue` : ''}`);
    reviewList.appendChild(a);
  }
  reviewCard.appendChild(reviewList);
  // Streak
  const streak = streakInfo(practiceByDay(app.attempts, app.settings.goalMinutes));
  const streakCard = el('div', { class: 'card' });
  streakCard.innerHTML = `<h2>Today</h2><b class="big">${Math.round(streak.todayMinutes)} / ${app.settings.goalMinutes} min</b><p class="hint">${streak.current}-day streak · ${streak.goalDays} goal-days${streak.nextTrophy ? ` · next trophy at ${streak.nextTrophy}` : ''}</p>`;
  const dash = el('a', { href: '#/dashboard' }, 'Progress →');
  streakCard.appendChild(dash);
  // Placement
  const placeCard = el('div', { class: 'card' });
  placeCard.innerHTML = `<h2>Where do you stand?</h2><p class="hint">An adaptive ladder of drills: pass and it climbs, miss and it drops. Three setbacks end it. Gives a 100–1900 score with a benchmark name.</p>`;
  const placeBtn = el('button', { id: 'placementBtn' }, 'Take the placement test');
  placeBtn.onclick = () => navigate('placement');
  placeCard.appendChild(placeBtn);
  hero.append(dailyCard, reviewCard, streakCard, placeCard);
  if (!isPiano) root.appendChild(hero);

  // Filters
  const bar = el('div', { class: 'filters' });
  const text = el('input', { type: 'text', placeholder: 'Search drills', id: 'search' });
  const skillSel = el('select', { id: 'skillFilter' });
  const genreSel = el('select', { id: 'genreFilter' });
  const controlSel = el('select', { id: 'controlFilter' });
  const tierSel = el('select', { id: 'tierFilter' });
  const availBtn = el('button', { id: 'availFilter' }, 'Available only');
  const profileSeg = el('div', { class: 'seg' });
  for (const [v, t] of [['flx4', 'DJ'], ['piano88', 'Piano']] as const) {
    const b = el('button', { 'data-v': v }, t);
    b.classList.toggle('on', profileFilter === v);
    b.onclick = () => navigate(`browse?profile=${v}`);
    profileSeg.appendChild(b);
  }
  const all = app.drills.filter((d) => (isPiano ? d.profile === 'piano88' : d.profile !== 'piano88'));
  const opts = (sel: HTMLSelectElement, label: string, values: string[]) => {
    sel.appendChild(el('option', { value: '' }, label));
    for (const v of [...new Set(values)].sort()) sel.appendChild(el('option', { value: v }, v));
  };
  opts(skillSel, 'Any skill', all.flatMap((d) => d.skills ?? []));
  opts(genreSel, 'Any genre', all.flatMap((d) => d.genre ?? []));
  opts(controlSel, 'Any control', all.flatMap((d) => d.targets.flatMap((t) => ('c' in t ? [app.controlName(t.c)] : []))));
  opts(tierSel, 'Any tier', all.map((d) => d.tier));
  bar.append(profileSeg, text, skillSel, genreSel, controlSel, tierSel, availBtn);
  root.appendChild(bar);

  const list = el('div');
  root.appendChild(list);

  function matches(d: Drill): boolean {
    if (filters.text && !`${d.name} ${d.lesson} ${(d.skills ?? []).join(' ')}`.toLowerCase().includes(filters.text.toLowerCase())) return false;
    if (filters.skill && !(d.skills ?? []).includes(filters.skill)) return false;
    if (filters.genre && !(d.genre ?? []).includes(filters.genre)) return false;
    if (filters.control && !d.targets.some((t) => 'c' in t && app.controlName(t.c) === filters.control)) return false;
    if (filters.tier && d.tier !== filters.tier) return false;
    if (filters.available && !availability(d, mapped, { capabilities: caps }).available) return false;
    return true;
  }

  function card(d: Drill): HTMLElement {
    const av = isPiano ? { available: true, reasons: [] } : availability(d, mapped, { capabilities: caps });
    const best = app.best[d.id];
    const medal = best == null ? null : best >= 96 ? 'gold' : best >= 90 ? 'silver' : best >= 80 ? 'bronze' : null;
    const href = `#/${d.profile === 'piano88' ? 'piano' : 'practice'}/${encodeURIComponent(d.id)}`;
    const a = el('a', { class: `drillcard${av.available ? '' : ' unavailable'}`, href, 'data-drill': d.id });
    a.appendChild(el('div', { class: 'name' }, d.name));
    const meta = el('div', { class: 'meta' }, `${d.bars} bars · ${d.bpm} BPM${d.artist ? ` · ${d.artist}` : ''}`);
    a.appendChild(meta);
    const badges = el('div');
    if (medal) badges.appendChild(el('span', { class: `badge ${medal}` }, `${medal} ${best}%`));
    else if (best != null) badges.appendChild(el('span', { class: 'badge' }, `best ${best}%`));
    if (due.some((r) => r.drillId === d.id)) badges.appendChild(el('span', { class: 'badge due' }, 'due'));
    const prereqs = (d.prereqs ?? []).filter((p) => (app.best[p] ?? 0) < 80);
    if (prereqs.length) badges.appendChild(el('span', { class: 'badge', title: prereqs.join(', ') }, `first: ${prereqs.map((p) => app.drill(p)?.name ?? p).join(', ')}`));
    for (const r of av.reasons) badges.appendChild(el('span', { class: 'badge lock' }, r.kind === 'unmapped' ? `unmapped: ${r.controls.map((c) => app.controlName(c)).join(', ')}` : r.kind === 'needsAudio' ? 'needs audio decks' : `needs ${r.hardware.join(', ')}`));
    for (const sk of (d.skills ?? []).slice(0, 3)) badges.appendChild(el('span', { class: 'badge' }, sk));
    a.appendChild(badges);
    return a;
  }

  function render(): void {
    list.innerHTML = '';
    const shown = all.filter(matches);
    if (isPiano) {
      const grid = el('div', { class: 'cards' });
      for (const d of shown.sort((a, b) => (a.level ?? 9) - (b.level ?? 9) || a.name.localeCompare(b.name))) grid.appendChild(card(d));
      list.appendChild(grid);
      return;
    }
    for (const p of paths()) {
      const inPath = shown.filter((d) => d.path === p.id);
      if (!inPath.length) continue;
      const sec = el('section', { class: 'path' });
      sec.appendChild(el('h2', {}, p.name));
      sec.appendChild(el('p', { class: 'desc' }, p.description));
      const levels = el('div', { class: 'levels' });
      for (const lv of p.levels) {
        const drillsAt = inPath.filter((d) => (d.level ?? 1) === lv.level);
        if (!drillsAt.length) continue;
        const done = drillsAt.every((d) => (app.best[d.id] ?? 0) >= 80);
        levels.appendChild(el('span', { class: `lvl${done ? ' done' : ''}` }, `L${lv.level} ${lv.name}${done ? ' ✓' : ''}`));
      }
      sec.appendChild(levels);
      const grid = el('div', { class: 'cards' });
      for (const d of inPath.sort((a, b) => (a.level ?? 9) - (b.level ?? 9) || tierRank(a.tier) - tierRank(b.tier) || a.name.localeCompare(b.name))) grid.appendChild(card(d));
      sec.appendChild(grid);
      list.appendChild(sec);
    }
    const noPath = shown.filter((d) => !d.path || !paths().some((p) => p.id === d.path));
    if (noPath.length) {
      const sec = el('section', { class: 'path' });
      sec.appendChild(el('h2', {}, 'Other'));
      const grid = el('div', { class: 'cards' });
      for (const d of noPath.sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.name.localeCompare(b.name))) grid.appendChild(card(d));
      sec.appendChild(grid);
      list.appendChild(sec);
    }
    // tier readiness
    const ready = el('div', { class: 'card', style: 'margin-top:14px' });
    ready.appendChild(el('h2', {}, 'Tier readiness'));
    for (const tier of ['Foundations', 'Mixing', 'Performance', 'Advanced', 'Pro']) {
      const r = tierReady(app.attempts, all, tier);
      const n = all.filter((d) => d.tier === tier).length;
      if (!n) continue;
      ready.appendChild(el('p', {}, `${tier}: ${r.ready ? 'ready for the next tier' : `${n - r.missing.length} of ${n} drills at bronze on the last three attempts`}`));
    }
    list.appendChild(ready);
  }

  // Generator
  if (!isPiano) {
    const gen = el('div', { class: 'card', style: 'margin:14px 0' });
    gen.appendChild(el('h2', {}, 'Generate a drill'));
    const row = el('div', { class: 'row' });
    const tplSel = el('select', { id: 'tpl' });
    for (const t of Object.keys(TEMPLATES)) tplSel.appendChild(el('option', { value: t }, t));
    const genreSel2 = el('select', { id: 'genGenre' });
    for (const g of genres()) genreSel2.appendChild(el('option', { value: g.id }, g.name));
    genreSel2.value = app.settings.genre;
    const barsIn = el('input', { type: 'number', id: 'genBars', min: '2', max: '64', value: String(genres().find((g) => g.id === app.settings.genre)?.transitionBars ?? 16) });
    const bpmIn = el('input', { type: 'number', id: 'genBpm', min: '60', max: '200', value: '125' });
    const seedIn = el('input', { type: 'number', id: 'genSeed', value: String(Math.floor(Math.random() * 1000)) });
    const genBtn = el('button', { class: 'primary', id: 'genBtn' }, 'Generate and play');
    genreSel2.onchange = () => {
      const g = genres().find((x) => x.id === genreSel2.value);
      if (g) {
        barsIn.value = String(g.transitionBars);
        bpmIn.value = String(Math.round((g.bpmRange[0] + g.bpmRange[1]) / 2));
      }
      void app.saveSettings({ genre: genreSel2.value });
    };
    genBtn.onclick = async () => {
      const d = generateFromTemplate(tplSel.value, { bars: Number(barsIn.value) || 8, bpm: Number(bpmIn.value) || 125, seed: Number(seedIn.value) || hashString(String(Date.now())) % 100000, genre: genreSel2.value });
      await app.addDrill(d, 'generated');
      navigate(`practice/${encodeURIComponent(d.id)}`);
    };
    row.append(el('label', {}, 'Template'), tplSel, el('label', {}, 'Genre'), genreSel2, el('label', {}, 'Bars'), barsIn, el('label', {}, 'BPM'), bpmIn, el('label', {}, 'Seed'), seedIn, genBtn);
    gen.appendChild(row);
    const g = genres().find((x) => x.id === app.settings.genre);
    if (g) gen.appendChild(el('p', { class: 'hint' }, `${g.name}: ${g.notes}`));
    root.insertBefore(gen, list);
  }

  text.oninput = () => {
    filters.text = text.value;
    render();
  };
  skillSel.onchange = () => {
    filters.skill = skillSel.value;
    render();
  };
  genreSel.onchange = () => {
    filters.genre = genreSel.value;
    render();
  };
  controlSel.onchange = () => {
    filters.control = controlSel.value;
    render();
  };
  tierSel.onchange = () => {
    filters.tier = tierSel.value;
    render();
  };
  availBtn.onclick = () => {
    filters.available = !filters.available;
    availBtn.classList.toggle('on', filters.available);
    render();
  };
  render();
  const off = app.on('map', () => {
    mapped = app.mapped();
    render();
  });
  return () => off();
};
