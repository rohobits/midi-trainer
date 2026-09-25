import { availability, dueToday, dailyChallenge, practiceByDay, streakInfo, generateFromTemplate, TEMPLATES, hashString, dayKey, tierReady, laneGroupOf, type Drill, type LaneGroup, type ControlDef } from '@midi-trainer/engine';
import type { View } from '../router';
import { navigate } from '../router';
import { paths, genres, tierRank } from '../content';
import { el } from '../ui/dom';
import { icon } from '../ui/icons';

const GROUP_VAR: Record<LaneGroup, string> = { deckA: '--deck-a', deckB: '--deck-b', mixer: '--mixer', pads: '--pads', fx: '--fx', select: '--select', lh: '--lh', rh: '--rh' };

/** Lane colour of a drill: the group of its first mapped control, or the hand for piano. */
export function drillColour(d: Drill, byId: Record<string, ControlDef>): string {
  if (d.profile === 'piano88') return 'var(--rh)';
  for (const t of d.targets) {
    if ('c' in t && typeof t.c === 'string' && byId[t.c]) return `var(${GROUP_VAR[laneGroupOf(byId[t.c]!)]})`;
  }
  return 'var(--line-strong)';
}

/** SVG progress ring, 56px, in the given colour. */
function ring(frac: number, colour: string, label: string, done: boolean): HTMLElement {
  const r = 24;
  const c = 2 * Math.PI * r;
  const host = el('div', { class: 'ring' });
  host.innerHTML = `<svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="${r}" fill="${done ? colour : 'var(--s1)'}" stroke="var(--line)" stroke-width="3"/><circle cx="28" cy="28" r="${r}" fill="none" stroke="${colour}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0, Math.min(1, frac)))}" transform="rotate(-90 28 28)"/></svg>`;
  host.appendChild(el('b', {}, label));
  return host;
}

/** Amber needle gauge for today's minutes against the goal. */
function gauge(minutes: number, goal: number): HTMLElement {
  const frac = Math.max(0, Math.min(1, minutes / goal));
  const ang = -90 + 180 * frac;
  const host = el('div', { class: 'gauge' });
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const a = ((-90 + 18 * i) * Math.PI) / 180;
    const x1 = 60 + Math.cos(a - Math.PI / 2) * 52;
    const y1 = 60 + Math.sin(a - Math.PI / 2) * 52;
    const x2 = 60 + Math.cos(a - Math.PI / 2) * (i % 5 === 0 ? 44 : 48);
    const y2 = 60 + Math.sin(a - Math.PI / 2) * (i % 5 === 0 ? 44 : 48);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--line-strong)" stroke-width="${i % 5 === 0 ? 2 : 1}"/>`;
  }).join('');
  host.innerHTML = `<svg viewBox="0 0 120 64"><path d="M8 60 A52 52 0 0 1 112 60" fill="none" stroke="var(--s3)" stroke-width="6"/><path d="M8 60 A52 52 0 0 1 112 60" fill="none" stroke="var(--amber)" stroke-width="6" stroke-dasharray="${(Math.PI * 52).toFixed(1)}" stroke-dashoffset="${(Math.PI * 52 * (1 - frac)).toFixed(1)}" stroke-linecap="round"/>${ticks}<g transform="rotate(${ang.toFixed(1)} 60 60)"><line x1="60" y1="60" x2="60" y2="14" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/><circle cx="60" cy="60" r="4" fill="var(--ink)"/></g></svg>`;
  return host;
}

export const browseView: View = (root, app, params) => {
  const profileFilter = params.query.get('profile') ?? 'flx4';
  const isPiano = profileFilter === 'piano88';
  let mapped = app.mapped();
  const caps = new Set(app.profile.capabilities);
  const byId: Record<string, ControlDef> = Object.fromEntries(app.profile.controls.map((c) => [c.id, c]));
  const filters = { skill: '', genre: '', control: '', tier: '', text: '', available: false };
  const all = app.drills.filter((d) => (isPiano ? d.profile === 'piano88' : d.profile !== 'piano88'));
  const due = dueToday(app.attempts);

  // ---------- tonight ----------
  if (!isPiano) {
    const tonight = el('div', { class: 'tonight' });
    const daily = dailyChallenge(app.drills, dayKey());
    const dailyBest = app.best[daily.drill.id];
    const dailyCard = el('div', { class: 'panel', style: `--accent: ${drillColour(daily.drill, byId)}` });
    dailyCard.innerHTML = `<div class="label">Daily challenge · ${new Date().toLocaleDateString(undefined, { weekday: 'long' })}</div><b class="big">${daily.drill.name.replace('Daily · ', '')}</b><p class="hint">${daily.twist}${dailyBest != null ? ` · your best today <b class="mono">${dailyBest}</b>` : ''}</p>`;
    const row = el('div', { class: 'row', style: 'margin-top:10px' });
    const dailyBtn = el('button', { class: 'primary', id: 'dailyBtn' });
    dailyBtn.appendChild(icon('play', 14));
    dailyBtn.appendChild(document.createTextNode(' Play today'));
    dailyBtn.onclick = async () => {
      await app.addDrill(daily.drill, 'daily');
      navigate(`practice/${encodeURIComponent(daily.drill.id)}`);
    };
    const placeBtn = el('button', { id: 'placementBtn', class: 'ghost' }, 'Placement test');
    placeBtn.onclick = () => navigate('placement');
    row.append(dailyBtn, placeBtn);
    dailyCard.appendChild(row);

    const reviewCard = el('div', { class: 'panel' });
    reviewCard.innerHTML = `<div class="label">Due for review</div><b class="big mono">${due.length}</b>`;
    const reviewList = el('div', { class: 'row' });
    for (const r of due.slice(0, 4)) {
      const d = app.drill(r.drillId);
      if (!d) continue;
      reviewList.appendChild(el('a', { href: `#/${d.profile === 'piano88' ? 'piano' : 'practice'}/${encodeURIComponent(d.id)}`, class: 'badge due' }, `${d.name}${r.overdueDays > 0 ? ` · ${r.overdueDays}d late` : ''}`));
    }
    if (!due.length) reviewList.appendChild(el('span', { class: 'hint' }, 'Nothing due. Pass a drill and it returns in a day, then 3, 7, 14, 30, 60.'));
    reviewCard.appendChild(reviewList);

    const streak = streakInfo(practiceByDay(app.attempts, app.settings.goalMinutes));
    const streakCard = el('div', { class: 'panel' });
    streakCard.innerHTML = `<div class="label">Tonight</div>`;
    const g = gauge(streak.todayMinutes, app.settings.goalMinutes);
    streakCard.appendChild(g);
    streakCard.appendChild(el('p', { class: 'hint' }, `${Math.round(streak.todayMinutes)} of ${app.settings.goalMinutes} min · ${streak.current}-day streak${streak.nextTrophy ? ` · trophy at ${streak.nextTrophy}` : ''}`));
    streakCard.appendChild(el('a', { href: '#/dashboard', class: 'hint' }, 'Progress →'));
    tonight.append(dailyCard, reviewCard, streakCard);
    root.appendChild(tonight);
  }

  // ---------- filters ----------
  const bar = el('div', { class: 'filters' });
  const profileSeg = el('div', { class: 'seg' });
  for (const [v, t] of [['flx4', 'DJ'], ['piano88', 'Piano']] as const) {
    const b = el('button', { 'data-v': v }, t);
    b.classList.toggle('on', profileFilter === v);
    b.onclick = () => navigate(`browse?profile=${v}`);
    profileSeg.appendChild(b);
  }
  const text = el('input', { type: 'search', placeholder: 'Search drills', id: 'search', style: 'min-width:200px' });
  const skillSel = el('select', { id: 'skillFilter' });
  const genreSel = el('select', { id: 'genreFilter' });
  const controlSel = el('select', { id: 'controlFilter' });
  const tierSel = el('select', { id: 'tierFilter' });
  const availBtn = el('button', { id: 'availFilter' }, 'Available only');
  const opts = (sel: HTMLSelectElement, label: string, values: string[]) => {
    sel.appendChild(el('option', { value: '' }, label));
    for (const v of [...new Set(values)].sort()) sel.appendChild(el('option', { value: v }, v));
  };
  opts(skillSel, 'Any skill', all.flatMap((d) => d.skills ?? []));
  opts(genreSel, 'Any genre', all.flatMap((d) => d.genre ?? []));
  opts(controlSel, 'Any control', all.flatMap((d) => d.targets.flatMap((t) => ('c' in t ? [app.controlName(t.c)] : []))));
  opts(tierSel, 'Any tier', all.map((d) => d.tier));
  const count = el('span', { class: 'hint mono', style: 'margin-left:auto' });
  bar.append(profileSeg, text, skillSel, genreSel, controlSel, tierSel, availBtn, count);
  root.appendChild(bar);

  // ---------- generator drawer ----------
  if (!isPiano) {
    const drawer = el('details', { class: 'drawer' });
    drawer.appendChild(el('summary', {}, 'Generate a drill from a template'));
    const gen = el('div', { class: 'panel' });
    const row = el('div', { class: 'row' });
    const tplSel = el('select', { id: 'tpl' });
    for (const t of Object.keys(TEMPLATES)) tplSel.appendChild(el('option', { value: t }, t));
    const genreSel2 = el('select', { id: 'genGenre' });
    for (const g of genres()) genreSel2.appendChild(el('option', { value: g.id }, g.name));
    genreSel2.value = app.settings.genre;
    const barsIn = el('input', { type: 'number', id: 'genBars', min: '2', max: '64', value: String(genres().find((g) => g.id === app.settings.genre)?.transitionBars ?? 16), style: 'width:64px' });
    const bpmIn = el('input', { type: 'number', id: 'genBpm', min: '60', max: '200', value: '125', style: 'width:72px' });
    const seedIn = el('input', { type: 'number', id: 'genSeed', value: String(Math.floor(Math.random() * 1000)), style: 'width:72px' });
    const genBtn = el('button', { class: 'primary', id: 'genBtn' }, 'Generate and play');
    const note = el('p', { class: 'hint', style: 'margin-top:8px' });
    const syncNote = () => {
      const g = genres().find((x) => x.id === genreSel2.value);
      note.textContent = g ? `${g.name}: ${g.notes}` : '';
    };
    genreSel2.onchange = () => {
      const g = genres().find((x) => x.id === genreSel2.value);
      if (g) {
        barsIn.value = String(g.transitionBars);
        bpmIn.value = String(Math.round((g.bpmRange[0] + g.bpmRange[1]) / 2));
      }
      void app.saveSettings({ genre: genreSel2.value });
      syncNote();
    };
    genBtn.onclick = async () => {
      const d = generateFromTemplate(tplSel.value, { bars: Number(barsIn.value) || 8, bpm: Number(bpmIn.value) || 125, seed: Number(seedIn.value) || hashString(String(Date.now())) % 100000, genre: genreSel2.value });
      await app.addDrill(d, 'generated');
      navigate(`practice/${encodeURIComponent(d.id)}`);
    };
    row.append(el('label', {}, 'Template'), tplSel, el('label', {}, 'Genre'), genreSel2, el('label', {}, 'Bars'), barsIn, el('label', {}, 'BPM'), bpmIn, el('label', {}, 'Seed'), seedIn, genBtn);
    gen.append(row, note);
    syncNote();
    drawer.appendChild(gen);
    root.appendChild(drawer);
  }

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
    const a = el('a', { class: `drillcard${av.available ? '' : ' unavailable'}${medal ? ` ${medal}` : ''}`, href, 'data-drill': d.id, style: `--lanecolor: ${drillColour(d, byId)}` });
    const top = el('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start' });
    top.appendChild(el('div', { class: 'name' }, d.name));
    if (best != null) top.appendChild(el('b', { class: `mono score ${medal ?? ''}` }, String(best)));
    a.appendChild(top);
    a.appendChild(el('div', { class: 'meta' }, `${d.bars} bars · ${d.bpm} BPM${d.level ? ` · L${d.level}` : ''}${d.artist ? ` · ${d.artist}` : ''}`));
    const badges = el('div', { class: 'row', style: 'gap:4px' });
    if (due.some((r) => r.drillId === d.id)) badges.appendChild(el('span', { class: 'badge due' }, 'due'));
    const prereqs = (d.prereqs ?? []).filter((p) => (app.best[p] ?? 0) < 80);
    if (prereqs.length) badges.appendChild(el('span', { class: 'badge', title: prereqs.map((p) => app.drill(p)?.name ?? p).join(', ') }, `after ${app.drill(prereqs[0]!)?.name ?? prereqs[0]}${prereqs.length > 1 ? ` +${prereqs.length - 1}` : ''}`));
    for (const r of av.reasons) {
      const b = el('span', { class: 'badge lock' });
      b.appendChild(icon('lock', 10));
      b.appendChild(document.createTextNode(' ' + (r.kind === 'unmapped' ? `unmapped: ${r.controls.map((c) => app.controlName(c)).join(', ')}` : r.kind === 'needsAudio' ? 'needs audio decks' : `needs ${r.hardware.join(', ')}`)));
      badges.appendChild(b);
    }
    for (const sk of (d.skills ?? []).slice(0, 2)) badges.appendChild(el('span', { class: 'badge' }, sk));
    if (badges.childElementCount) a.appendChild(badges);
    return a;
  }

  function skillMap(p: ReturnType<typeof paths>[number], inPath: Drill[]): HTMLElement {
    const map = el('div', { class: 'skillmap' });
    const colour = drillColour(inPath[0]!, byId);
    let firstOpen = true;
    for (const lv of p.levels) {
      const drillsAt = inPath.filter((d) => (d.level ?? 1) === lv.level);
      if (!drillsAt.length) continue;
      const passed = drillsAt.filter((d) => (app.best[d.id] ?? 0) >= 80).length;
      const done = passed === drillsAt.length;
      const active = !done && firstOpen;
      if (!done) firstOpen = false;
      const node = el('a', { class: `node${done ? ' done' : ''}${active ? ' active' : ''}`, href: `#/practice/${encodeURIComponent(drillsAt[0]!.id)}` });
      node.appendChild(ring(passed / drillsAt.length, colour, `L${lv.level}`, done));
      node.appendChild(el('span', {}, lv.name));
      node.appendChild(el('small', { class: 'mono' }, `${passed}/${drillsAt.length}`));
      map.appendChild(node);
    }
    return map;
  }

  function render(): void {
    list.innerHTML = '';
    const shown = all.filter(matches);
    count.textContent = `${shown.length} of ${all.length}`;
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
      const head = el('div', { class: 'pathhead' });
      head.appendChild(el('h2', {}, p.name));
      head.appendChild(el('span', { class: 'desc' }, p.description));
      sec.appendChild(head);
      sec.appendChild(skillMap(p, inPath));
      const grid = el('div', { class: 'cards' });
      for (const d of inPath.sort((a, b) => (a.level ?? 9) - (b.level ?? 9) || tierRank(a.tier) - tierRank(b.tier) || a.name.localeCompare(b.name))) grid.appendChild(card(d));
      sec.appendChild(grid);
      list.appendChild(sec);
    }
    const noPath = shown.filter((d) => !d.path || !paths().some((p) => p.id === d.path));
    if (noPath.length) {
      const sec = el('section', { class: 'path' });
      const head = el('div', { class: 'pathhead' });
      head.appendChild(el('h2', {}, 'Other'));
      head.appendChild(el('span', { class: 'desc' }, 'Generated, imported and daily drills.'));
      sec.appendChild(head);
      const grid = el('div', { class: 'cards' });
      for (const d of noPath.sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.name.localeCompare(b.name))) grid.appendChild(card(d));
      sec.appendChild(grid);
      list.appendChild(sec);
    }
    const ready = el('div', { class: 'panel', style: 'margin-top:18px' });
    ready.appendChild(el('div', { class: 'label' }, 'Tier readiness'));
    const rows = el('div', { class: 'tierrows' });
    for (const tier of ['Foundations', 'Mixing', 'Performance', 'Advanced', 'Pro']) {
      const r = tierReady(app.attempts, all, tier);
      const n = all.filter((d) => d.tier === tier).length;
      if (!n) continue;
      const done = n - r.missing.length;
      const row = el('div', { class: 'tierrow' });
      row.appendChild(el('b', {}, tier));
      const pb = el('div', { class: 'progressbar' });
      pb.appendChild(el('i', { style: `width:${Math.round((100 * done) / n)}%` }));
      row.appendChild(pb);
      row.appendChild(el('span', { class: 'mono hint' }, r.ready ? 'ready' : `${done}/${n}`));
      rows.appendChild(row);
    }
    ready.appendChild(rows);
    ready.appendChild(el('p', { class: 'hint', style: 'margin-top:8px' }, 'A tier is ready when every drill in it sits at bronze or better on the last three attempts.'));
    list.appendChild(ready);
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
