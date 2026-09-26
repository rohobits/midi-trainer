import {
  DrillRun, HighwayRenderer, TapTempo, highwayThemeFromCss, resolveThresholds, availability, lengthBeats, dueToday, MidiClock, laneGroups,
  type Drill, type RunStats, type AttemptRecord, type TapState, type SelectState,
} from '@midi-trainer/engine';
import type { App, ControlEvent } from '../app';
import type { View } from '../router';
import { navigate } from '../router';
import { tierRank } from '../content';
import { $, el } from '../ui/dom';
import { md } from '../ui/markdown';
import { createStage } from '../ui/stage';
import { createController } from '../ui/controller';
import { showResults, hideResults } from '../ui/results';
import { icon } from '../ui/icons';
import { getMixer } from './mix';

function isControlDrill(d: Drill): boolean {
  return d.targets.every((t) => t.type !== 'note');
}

export function orderedControlDrills(app: App): Drill[] {
  return app.drills
    .filter(isControlDrill)
    .sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || (a.level ?? 99) - (b.level ?? 99) || a.name.localeCompare(b.name));
}

export const practiceView: View = (root, app, params) => {
  const ordered = orderedControlDrills(app);
  const want = params.id ?? app.settings.lastDrill;
  let drill: Drill | undefined = ordered.find((d) => d.id === want) ?? app.drill(want ?? '') ?? ordered[0];
  if (!drill) {
    root.appendChild(el('p', { class: 'hint' }, 'No drills available.'));
    return;
  }
  const s = app.settings;
  let run: DrillRun | null = null;
  let raf = 0;
  let startedAt = 0;
  let section: [number, number] | null = drill.section ?? null;
  let lastCombo = 0;
  let lastPointerMove = 0;
  let placementTimer = 0;
  const tapTempo = new TapTempo();
  const offs: Array<() => void> = [];
  const testMode = params.query.get('test') === '1';
  const frozenAt = testMode && params.query.has('t') ? Number(params.query.get('t')) : null;

  // ---------- rail ----------
  const rail = el('div', { class: 'rail', id: 'rail' });
  const nav = el('div', { class: 'group' });
  const prevBtn = el('button', { id: 'prevDrill', title: 'Previous drill (Alt+←)', class: 'small' });
  prevBtn.appendChild(icon('prev'));
  const nextBtn = el('button', { id: 'nextDrill', title: 'Next drill (Alt+→)', class: 'small' });
  nextBtn.appendChild(icon('next'));
  const browseBtn = el('button', { id: 'browseBtn', class: 'small ghost' }, 'All drills');
  nav.append(prevBtn, nextBtn, browseBtn);
  const bpmGroup = el('div', { class: 'group' });
  const bpmInput = el('input', { type: 'number', id: 'bpm', min: '20', max: '400', value: String(drill.bpm), 'aria-label': 'BPM' });
  const tapBtn = el('button', { id: 'tapTempo', class: 'small' }, 'Tap');
  const tempoSeg = el('div', { class: 'seg', id: 'tempoSeg', title: 'Tempo' });
  for (const v of [50, 75, 90, 100]) {
    const b = el('button', { 'data-v': String(v) }, `${v}%`);
    b.classList.toggle('on', Math.round(s.tempoScale * 100) === v);
    tempoSeg.appendChild(b);
  }
  bpmGroup.append(el('label', { for: 'bpm' }, 'BPM'), bpmInput, tapBtn, tempoSeg);
  const toggles = el('div', { class: 'seg', id: 'toggles' });
  const mkToggle = (id: string, text: string, on: boolean, title: string) => {
    const b = el('button', { id, title }, text);
    b.classList.toggle('on', on);
    toggles.appendChild(b);
    return b;
  };
  const clickBtn = mkToggle('clickBtn', 'Click', s.click, 'Metronome');
  const loopBtn = mkToggle('loopBtn', 'Loop', s.loop, 'Repeat the drill');
  const waitBtn = mkToggle('waitBtn', 'Wait', s.waitMode, 'Freeze on each press until you hit it');
  const perfBtn = mkToggle('perfBtn', 'Perform', s.performanceMode, 'Multiplier, Euphoria (E) and energy');
  const masterBtn = mkToggle('masterBtn', 'Master', s.masterMode, 'Hide the highway after three golds');
  const ghostBtn = mkToggle('ghostBtn', 'Ghost', s.showGhost, 'Draw your best run behind the targets');
  const ctlBtn = mkToggle('ctlBtn', 'Pads', s.showController, 'On-screen controller');
  const isoSeg = el('div', { class: 'seg', id: 'isoSeg', title: 'Isolate' });
  for (const [v, t] of [['all', 'All'], ['A', 'Deck A'], ['B', 'Deck B'], ['mixer', 'Mixer']] as const) {
    const b = el('button', { 'data-v': v }, t);
    b.classList.toggle('on', s.isolation === v);
    isoSeg.appendChild(b);
  }
  const secGroup = el('div', { class: 'group' });
  const secFrom = el('input', { type: 'number', id: 'secFrom', min: '1', value: section ? String(section[0]) : '', placeholder: '1', style: 'width:52px', 'aria-label': 'Section from bar' });
  const secTo = el('input', { type: 'number', id: 'secTo', min: '1', value: section ? String(section[1]) : '', placeholder: '16', style: 'width:52px', 'aria-label': 'Section to bar' });
  const secClear = el('button', { class: 'small ghost', id: 'secClear' }, 'whole');
  secGroup.append(el('label', {}, 'Bars'), secFrom, secTo, secClear);
  const transport = el('div', { class: 'group' });
  const playBtn = el('button', { class: 'primary', id: 'playBtn' }, 'Start');
  const resetBtn = el('button', { id: 'resetBtn', title: 'Restart' });
  resetBtn.appendChild(icon('restart'));
  transport.append(playBtn, resetBtn);
  rail.append(transport, nav, bpmGroup, toggles, isoSeg, secGroup);
  root.appendChild(rail);

  const stage = createStage(root);
  const renderer = new HighwayRenderer(stage.ctx, highwayThemeFromCss());
  renderer.setReducedMotion(app.reducedMotion);
  renderer.setFov(s.fov);
  const below = el('div', { class: 'below' });
  const lessonCard = el('div', { class: 'panel', id: 'lesson' });
  const statsCard = el('div', { class: 'panel' });
  statsCard.innerHTML = `<h2>This run</h2>
    <div class="stats">
      <div class="stat"><b id="sScore">—</b><span>score</span></div>
      <div class="stat"><b id="sTiming">—</b><span>avg ms</span></div>
      <div class="stat"><b id="sTrack">—</b><span>tracking</span></div>
      <div class="stat"><b id="sBest">—</b><span>best</span></div>
    </div>
    <div class="tiers" id="tiers"><span class="t-perfect">Perfect<b>0</b></span><span class="t-great">Great<b>0</b></span><span class="t-ok">OK<b>0</b></span><span class="t-miss">Miss<b>0</b></span><span class="t-extra">Extra<b>0</b></span><span class="t-tech">Technique<b>—</b></span></div>
    <div class="legend"><span><i style="background:var(--deck-a)"></i>deck A</span><span><i style="background:var(--deck-b)"></i>deck B</span><span><i style="background:var(--mixer)"></i>mixer</span><span><i style="background:var(--fx)"></i>FX</span><span><i style="background:var(--pads)"></i>sampler</span><span><i style="background:var(--perfect)"></i>hit</span><span><i style="background:var(--miss)"></i>miss</span></div>
    <div class="explain" id="explain"></div>
    <p class="hint" id="hint"></p>`;
  below.append(lessonCard, statsCard);
  root.appendChild(below);
  const ctlHost = el('div');
  root.appendChild(ctlHost);
  let ctlOff: (() => void) | null = null;

  // ---------- helpers ----------
  const names = app.names();
  const kinds = app.kinds();
  const groups = laneGroups(app.profile);
  const bpb = () => drill!.timeSig?.[0] ?? 4;
  const now = () => (frozenAt != null && run ? startedAt + (frozenAt * 60000) / run.bpm : performance.now());

  function onlyLanes(): string[] | null {
    const iso = app.settings.isolation;
    if (iso === 'all') return null;
    const byId = Object.fromEntries(app.profile.controls.map((c) => [c.id, c]));
    return run!.lanes.filter((l) => {
      const c = byId[l];
      if (!c) return false;
      if (iso === 'mixer') return ['Mixer', 'EQ', 'Filter'].includes(c.group);
      return c.deck === iso || (!c.deck && c.id === 'xf');
    });
  }

  function goldCount(): number {
    return app.attempts.filter((a) => a.drillId === drill!.id && a.medal === 'gold' && (a.tempoScale ?? 1) >= 1).length;
  }

  function ghostLog(): AttemptRecord['inputLog'] | null {
    if (!app.settings.showGhost) return null;
    const best = app.attempts.filter((a) => a.drillId === drill!.id && a.score != null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    return best?.inputLog ?? null;
  }

  function buildRun(only: string[] | null): DrillRun {
    const st = app.settings;
    const d = drill!;
    return new DrillRun(d, {
      thresholds: resolveThresholds(d, st.thresholds),
      strictness: st.strictness,
      inputOffsetMs: st.inputOffsetMs,
      countInBars: st.countInBars,
      loop: st.loop,
      initialValues: app.values,
      kinds,
      tempoScale: st.tempoScale,
      section,
      waitMode: st.waitMode,
      mode: st.performanceMode ? 'performance' : 'lesson',
      onlyLanes: only,
    });
  }

  function newRun(): void {
    const d = drill!;
    run = buildRun(null);
    const only = onlyLanes();
    if (only) run = buildRun(only);
    const bpmOverride = Number(bpmInput.value);
    if (bpmOverride && bpmOverride !== d.bpm) run.setBpm(bpmOverride * app.settings.tempoScale, performance.now());
    lastCombo = 0;
    renderer.effects.clear();
    playBtn.textContent = 'Start';
    stage.msg.style.display = 'none';
    hideResults(stage.results);
    stage.perf.style.display = app.settings.performanceMode ? 'block' : 'none';
    rail.classList.remove('dim');
    updateStats();
    draw();
  }

  function loadDrill(d: Drill): void {
    drill = d;
    section = d.section ?? null;
    secFrom.value = section ? String(section[0]) : '';
    secTo.value = section ? String(section[1]) : '';
    bpmInput.value = String(d.bpm);
    stage.name.textContent = d.name;
    const av = availability(d, app.mapped(), { capabilities: new Set(app.profile.capabilities) });
    const reasons = av.reasons
      .map((r) => (r.kind === 'unmapped' ? `Unmapped: ${r.controls.map((c) => names[c] ?? c).join(', ')}. Open Map controls.` : r.kind === 'needsAudio' ? (getMixer()?.a.loaded ? '' : 'Best with audio: open Decks, start audio and load two tracks; deck A then plays along with this drill.') : `Needs hardware this profile lacks: ${r.hardware.join(', ')}.`))
      .filter(Boolean);
    lessonCard.innerHTML =
      md(d.lesson || '## Loaded drill\n\nCustom drill from file.') +
      (d.sources?.length ? `<h3>Sources</h3><p class="hint">${d.sources.map((u) => `<a href="${u}" target="_blank" rel="noopener">${new URL(u).hostname}</a>`).join(' · ')}</p>` : '') +
      (d.artist ? `<p class="hint">Technique attributed to ${d.artist} by the sources above.</p>` : '') +
      (reasons.length ? `<p class="hint" style="color:var(--amber)">${reasons.join(' ')}</p>` : '');
    $('hint').textContent = `${d.bars} bars at ${d.bpm} BPM · ${d.tier}${d.path ? ` · ${d.path} L${d.level ?? '?'}` : ''}. ${names[app.settings.autoStartControl] ?? 'Play A'} or Space on a phrase downbeat starts the clock. E fires Euphoria in perform mode.`;
    void app.saveSettings({ lastDrill: d.id });
    const q = params.query.toString();
    location.hash = `#/practice/${encodeURIComponent(d.id)}${q ? '?' + q : ''}`;
    newRun();
    renderExplain();
  }

  function renderExplain(): void {
    const host = $('explain');
    host.innerHTML = '';
    for (const c of run!.lanes) {
      const chip = el('div', { class: 'chip', 'data-chip': c });
      chip.appendChild(el('span', {}, names[c] ?? c));
      chip.appendChild(el('b', {}, kinds[c] === 'cc' ? `${Math.round((app.values[c] ?? 0) * 100)}%` : kinds[c] === 'rel' ? 'jog' : 'press'));
      host.appendChild(chip);
    }
  }

  function updateExplain(ev: ControlEvent): void {
    if (ev.kind === 'noteon' || ev.kind === 'noteoff') return;
    const chip = document.querySelector<HTMLElement>(`[data-chip="${ev.c}"] b`);
    if (!chip) return;
    if (ev.kind === 'cc') chip.textContent = `${Math.round(ev.value * 100)}%`;
    else if (ev.kind === 'rel') chip.textContent = ev.delta > 0 ? '→' : '←';
    else if (ev.kind === 'tap') chip.textContent = 'pressed';
  }

  function routeToMixer(ev: ControlEvent): void {
    const m = getMixer();
    if (!m || !drill?.needsAudio || ev.kind !== 'cc') return;
    const d = ev.c.endsWith('A') ? m.a : ev.c.endsWith('B') ? m.b : null;
    const base = ev.c.replace(/[AB]$/, '');
    if (d) {
      if (base === 'fader') d.setFader(ev.value);
      else if (base === 'low') d.setEq('low', ev.value);
      else if (base === 'mid') d.setEq('mid', ev.value);
      else if (base === 'hi') d.setEq('high', ev.value);
      else if (base === 'filt') d.setFilter(ev.value);
      else if (base === 'tempo') d.setTempoFader(ev.value);
      else if (base === 'trim') d.setTrim(ev.value);
    } else if (ev.c === 'xf') m.setCrossfader(ev.value);
  }

  function startStop(): void {
    if (!run) return;
    app.unlockAudio();
    const t = performance.now();
    if (run.active) {
      run.stop(t);
      getMixer()?.a.pause();
      playBtn.textContent = 'Start';
      rail.classList.remove('dim');
      cancelAnimationFrame(raf);
      return;
    }
    if (run.phase === 'finished' || run.phase === 'failed') newRun();
    startedAt = t;
    run!.start(t);
    const mixer = getMixer();
    if (drill!.needsAudio && mixer?.a.loaded) {
      mixer.a.seek(0);
      mixer.a.play(0);
      if (mixer.b.loaded) mixer.b.seek(0);
    }
    playBtn.textContent = 'Stop';
    hideResults(stage.results);
    lastPointerMove = t;
    app.sfx.play('select', { gain: 0.5 });
    if (frozenAt != null) {
      run!.tick(now());
      updateStats();
      draw();
      (window as unknown as { __frameReady?: boolean }).__frameReady = true;
      return;
    }
    loop();
  }

  function loop(): void {
    cancelAnimationFrame(raf);
    if (!run || !run.active) return;
    const t = performance.now();
    const r = run.tick(t);
    const frame = frameOf(t);
    for (const b of r.beats) {
      if (b >= 0 && app.settings.click) app.sounds.click(b % bpb() === 0);
      else if (b < 0) app.sfx.play('tick', { gain: 0.5 });
    }
    for (const id of r.missed) {
      const st = run.states[id];
      if (st && st.kind !== 'note') {
        renderer.pushEvent({ kind: 'miss', lane: st.c }, frame, t);
        app.sfx.play('miss', { gain: 0.5 });
      }
    }
    for (const id of r.finished) {
      const st = run.states[id];
      if (st && (st.kind === 'ramp' || st.kind === 'cross' || st.kind === 'jog')) {
        renderer.pushEvent({ kind: 'ramp', lane: st.c, hit: st.hit }, frame, t);
        app.sfx.play(st.hit ? 'hit' : 'miss', { gain: 0.4 });
      }
    }
    if (run.perf) {
      const c = run.perf.combo;
      if (c !== lastCombo) {
        renderer.pushEvent({ kind: 'combo', count: c }, frame, t);
        if (c > 0 && c % 10 === 0) app.sfx.play('combo');
        lastCombo = c;
      }
    }
    if (r.looped) renderer.effects.clear();
    const pos = run.pos(t);
    const cue = run.cue(pos, names, 2);
    void cue;
    stage.msg.style.display = 'none';
    if (t - lastPointerMove > 2000) rail.classList.add('dim');
    updateStats();
    draw(frame);
    if (r.ended) {
      playBtn.textContent = 'Start';
      stage.msg.style.display = 'none';
      rail.classList.remove('dim');
      void finishRun();
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  async function finishRun(): Promise<void> {
    if (!run || !drill) return;
    const attempt = run.attempt(app.profile.id);
    const res = await app.addAttempt(attempt);
    const prev = res.isPb ? null : (app.best[drill.id] ?? null);
    showResults(stage.results, {
      drill,
      attempt,
      isPb: res.isPb,
      prevBest: prev,
      xp: res.xp,
      leveledUp: res.leveledUp,
      level: res.level,
      streakLine: res.streak.todayMet ? `Daily goal met · ${res.streak.current}-day streak` : `${Math.max(0, Math.ceil(app.settings.goalMinutes - res.streak.todayMinutes))} min to today's goal`,
      failed: run.phase === 'failed',
      reduced: app.reducedMotion,
      sfx: app.sfx,
      onAgain: () => {
        newRun();
        startStop();
      },
      onSlower: () => {
        const next = Math.max(0.5, Math.round((app.settings.tempoScale - 0.1) * 10) / 10);
        void app.saveSettings({ tempoScale: next }).then(() => {
          syncTempoSeg();
          newRun();
          startStop();
        });
      },
      onNext: () => step(1),
      onHistory: () => navigate(`history/${encodeURIComponent(drill!.id)}`),
    });
    updateStats();
    if (params.query.get('placement')) {
      placementTimer = window.setTimeout(() => navigate(`placement?score=${attempt.score ?? 'null'}`), 2400);
      return;
    }
    if (app.settings.autoBpm && attempt.passed && app.settings.tempoScale < 1) {
      const nextScale = Math.min(1, Math.round((app.settings.tempoScale + 0.1) * 10) / 10);
      await app.saveSettings({ tempoScale: nextScale });
      syncTempoSeg();
      app.toast(`Clean at ${Math.round((nextScale - 0.1) * 100)}%. Tempo up to ${Math.round(nextScale * 100)}%.`);
    } else if (app.settings.autoBpm && attempt.medal === 'gold' && app.settings.tempoScale >= 1) {
      app.toast('Gold at full tempo. Try the next drill in the path.');
    }
    if (app.settings.masterMode && goldCount() === 3) app.toast('Three golds: the highway is hidden from now on. Play from memory.');
  }

  function syncTempoSeg(): void {
    tempoSeg.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === Math.round(app.settings.tempoScale * 100)));
  }

  function updateStats(): void {
    if (!run || !drill) return;
    const st: RunStats = run.stats();
    $('sScore').textContent = st.score == null ? '—' : `${st.score}`;
    $('sTiming').textContent = st.timingMeanMs == null ? '—' : `${st.timingMeanMs}`;
    $('sTrack').textContent = st.sub.tracking == null ? '—' : `${st.sub.tracking}`;
    const best = app.best[drill.id];
    $('sBest').textContent = best == null ? '—' : `${best}`;
    const tiers = $('tiers').querySelectorAll('b');
    tiers[0]!.textContent = String(st.tiers.perfect);
    tiers[1]!.textContent = String(st.tiers.great);
    tiers[2]!.textContent = String(st.tiers.ok);
    tiers[3]!.textContent = String(st.tiers.miss);
    tiers[4]!.textContent = String(run.extraPresses);
    tiers[5]!.textContent = st.sub.technique == null ? '—' : `${st.sub.technique}`;
    stage.score.textContent = st.score == null ? '—' : `${st.score}`;
    stage.acc.textContent = st.completed ? `${st.completed}/${st.total} judged` : `${st.total} targets`;
    const t = now();
    const pos = run.pos(t);
    const total = lengthBeats(drill);
    const bb = run.transport.barBeat(pos);
    const totalBars = Math.ceil(total / bpb());
    const phraseLen = bpb() * 8;
    const phrase = Math.floor(Math.max(0, pos) / phraseLen) + 1;
    const phrases = Math.max(1, Math.ceil(total / phraseLen));
    const secStart = section ? (section[0] - 1) * bpb() : 0;
    stage.sub.textContent =
      run.phase === 'idle' || run.phase === 'finished' || run.phase === 'failed'
        ? `${totalBars} bars · ${Math.round(run.bpm * 10) / 10} BPM${section ? ` · section ${section[0]}–${section[1]}` : ''} · waiting for ${names[app.settings.autoStartControl] ?? 'Start'}`
        : pos < secStart
          ? `count-in`
          : `bar ${bb.bar} of ${totalBars} · beat ${bb.beat} · phrase ${phrase}/${phrases}`;
    const cue = run.cue(pos, names, 999);
    if (cue && run.active) {
      const beats = cue.beatsAway;
      const bars = Math.floor(beats / bpb());
      stage.next.innerHTML = `next <b>${cue.text.replace(/^(Tap|Move|Cut|Swap|Jog|Choose|Hold) /, '').replace(/ in \d+ beats$/, '')}</b> ${beats <= 0 ? ' · now' : ` in ${bars >= 1 ? `${bars} bar${bars > 1 ? 's' : ''}` : `${beats} beat${beats === 1 ? '' : 's'}`}`}`;
    } else stage.next.textContent = run.active ? 'no more targets' : `${drill.tier}${drill.path ? ` · ${drill.path}` : ''} · Space to start`;
    const ticks: { at: number; phrase: boolean }[] = [];
    for (let b = bpb(); b < total; b += bpb()) ticks.push({ at: b / total, phrase: b % phraseLen === 0 });
    stage.setProgress(Math.max(0, pos) / total, ticks);
    if (run.perf) {
      const p = run.perf.snapshot();
      stage.perf.innerHTML = `<div class="mult">${p.multiplier}×</div><div class="pts">${p.points.toLocaleString()} pts · combo ${p.combo}</div><div class="charge ${p.euphoriaCharge && p.euphoriaActiveUntil == null ? 'ready' : ''}">${p.euphoriaActiveUntil != null ? 'EUPHORIA' : p.euphoriaCharge ? `${'⚡'.repeat(p.euphoriaCharge)} press E` : 'clean phrase charges Euphoria'}</div><div class="energy"><i style="width:${Math.round(p.energy * 100)}%"></i></div>`;
    }
  }

  function frameOf(t: number) {
    const r = run!;
    const pos = r.pos(t);
    const secStart = section ? (section[0] - 1) * bpb() : 0;
    const perf = r.perf?.snapshot();
    let waiting: { lane: string; label: string } | null = null;
    if (r.waiting) {
      const next = r.cue(pos, names, 999);
      const lane = r.lanes.find((l) => next?.text.includes(names[l] ?? l)) ?? r.lanes[0]!;
      waiting = { lane, label: `Waiting for ${names[lane] ?? lane}` };
    }
    return {
      lanes: r.lanes,
      states: r.states,
      values: r.values,
      names,
      kinds,
      groups,
      mapped: app.mapped(),
      pos,
      beatsPerBar: bpb(),
      lookahead: app.settings.lookahead,
      hitWindowBeats: app.settings.showHitWindow ? r.thresholds.tapWindowBeats : undefined,
      fade: app.settings.masterMode && goldCount() >= 3 ? 1 : 0,
      ghost: ghostLog(),
      waiting,
      countIn: r.phase === 'countin' ? secStart - pos : null,
      combo: perf ? { count: perf.combo, multiplier: perf.multiplier, euphoriaCharge: perf.euphoriaCharge, euphoriaActive: perf.euphoriaActiveUntil != null, energy: perf.energy } : null,
    };
  }

  function draw(frame = run ? frameOf(now()) : null): void {
    if (!run || !frame) return;
    renderer.draw(frame, now());
    if (!run.active && renderer.effects.busy && frozenAt == null) requestAnimationFrame(() => draw());
  }

  function step(dir: 1 | -1): void {
    const i = Math.max(0, ordered.findIndex((d) => d.id === drill!.id));
    const n = ordered[(i + dir + ordered.length) % ordered.length];
    if (n) loadDrill(n);
  }

  // ---------- wiring ----------
  prevBtn.onclick = () => step(-1);
  nextBtn.onclick = () => step(1);
  browseBtn.onclick = () => navigate('browse');
  playBtn.onclick = startStop;
  resetBtn.onclick = newRun;
  bpmInput.onchange = () => {
    const bpm = Number(bpmInput.value) || drill!.bpm;
    run?.setBpm(bpm * app.settings.tempoScale, performance.now());
  };
  tapBtn.onclick = () => {
    const bpm = tapTempo.tap(performance.now());
    app.sfx.play('tick', { gain: 0.4 });
    if (bpm) {
      bpmInput.value = String(bpm);
      run?.setBpm(bpm * app.settings.tempoScale, performance.now());
    }
  };
  tempoSeg.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.onclick = () => {
      const scale = Number(b.dataset.v) / 100;
      void app.saveSettings({ tempoScale: scale }).then(() => {
        syncTempoSeg();
        if (run && !run.active) newRun();
        else run?.setBpm((Number(bpmInput.value) || drill!.bpm) * scale, performance.now());
      });
    };
  });
  const toggle = (b: HTMLButtonElement, key: 'click' | 'loop' | 'waitMode' | 'performanceMode' | 'masterMode' | 'showGhost' | 'showController', after?: () => void) => {
    b.onclick = () => {
      const v = !app.settings[key];
      b.classList.toggle('on', v);
      void app.saveSettings({ [key]: v } as Partial<typeof app.settings>).then(() => {
        if (key === 'click') app.unlockAudio();
        if (['loop', 'waitMode', 'performanceMode'].includes(key) && run && !run.active) newRun();
        after?.();
        draw();
      });
    };
  };
  toggle(clickBtn, 'click');
  toggle(loopBtn, 'loop');
  toggle(waitBtn, 'waitMode');
  toggle(perfBtn, 'performanceMode');
  toggle(masterBtn, 'masterMode');
  toggle(ghostBtn, 'showGhost');
  toggle(ctlBtn, 'showController', () => mountController());
  isoSeg.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.onclick = () => {
      isoSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      void app.saveSettings({ isolation: b.dataset.v as typeof app.settings.isolation }).then(() => newRun());
    };
  });
  const applySection = () => {
    const a = Number(secFrom.value);
    const b = Number(secTo.value) || (a >= 1 ? drill!.bars : 0);
    section = a >= 1 && b >= a ? [a, b] : null;
    newRun();
  };
  secFrom.onchange = applySection;
  secTo.onchange = applySection;
  secClear.onclick = () => {
    secFrom.value = '';
    secTo.value = '';
    section = null;
    newRun();
  };
  function mountController(): void {
    ctlOff?.();
    ctlOff = null;
    if (app.settings.showController) ctlOff = createController(app, ctlHost, { compact: true });
  }
  mountController();

  // on-screen: click a pad lane on the canvas, drag a fader lane
  let dragLane: number | null = null;
  stage.canvas.addEventListener('pointerdown', (e) => {
    if (!run) return;
    app.unlockAudio();
    const r = stage.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const i = renderer.laneAt(x);
    const lane = run.lanes[i];
    if (!lane) return;
    if (kinds[lane] === 'cc') {
      dragLane = i;
      stage.canvas.setPointerCapture(e.pointerId);
      app.virtual({ kind: 'cc', c: lane, value: renderer.valueAt(i, x), timeStamp: performance.now() });
    } else app.virtual({ kind: 'tap', c: lane, timeStamp: performance.now() });
  });
  stage.canvas.addEventListener('pointermove', (e) => {
    if (dragLane == null || !run) return;
    const r = stage.canvas.getBoundingClientRect();
    const lane = run.lanes[dragLane]!;
    app.virtual({ kind: 'cc', c: lane, value: renderer.valueAt(dragLane, e.clientX - r.left), timeStamp: performance.now() });
  });
  stage.canvas.addEventListener('pointerup', () => (dragLane = null));

  offs.push(
    app.on('control', (ev) => {
      updateExplain(ev);
      routeToMixer(ev);
      if (!run) return;
      const t = ev.kind === 'noteon' || ev.kind === 'noteoff' ? performance.now() : ev.timeStamp;
      if (ev.kind === 'tap') {
        if (!run.active && app.settings.autoStart && ev.c === app.settings.autoStartControl) {
          startStop();
          return;
        }
        const res = run.onTap(ev.c, t);
        const frame = frameOf(t);
        if (res.target && res.target.kind === 'tap') {
          const tg = res.target as TapState;
          renderer.pushEvent({ kind: 'hit', lane: ev.c, tier: tg.tier, errMs: tg.errMs }, frame, t);
          app.sfx.play(tg.tier === 'perfect' ? 'perfect' : 'hit', { gain: tg.tier === 'miss' ? 0.3 : 0.6 });
        } else if (res.target && res.target.kind === 'select') {
          const sel = res.target as SelectState;
          renderer.pushEvent({ kind: 'hit', lane: ev.c, tier: sel.hit ? 'perfect' : 'miss', errMs: null }, frame, t);
          app.sfx.play(sel.hit ? 'perfect' : 'miss', { gain: 0.5 });
        } else renderer.pushEvent({ kind: 'press', lane: ev.c, ok: !res.extra }, frame, t);
        if (res.extra) app.sfx.play('miss', { gain: 0.25 });
        updateStats();
      } else if (ev.kind === 'cc') {
        const before = run.states.filter((s) => s.kind === 'cut' && s.hit).length;
        run.onValue(ev.c, ev.value, t);
        const after = run.states.filter((s) => s.kind === 'cut' && s.hit).length;
        if (after > before) {
          const landed = run.states.find((s) => s.kind === 'cut' && s.hit && s.hitAt != null && Math.abs((s.hitAt ?? 0) - run!.inputPos(t)) < 0.01);
          const tier = landed && landed.kind === 'cut' ? landed.tier : 'great';
          const err = landed && landed.kind === 'cut' ? landed.errMs : null;
          renderer.pushEvent({ kind: 'hit', lane: ev.c, tier, errMs: err, value: ev.value }, frameOf(t), t);
          app.sfx.play(tier === 'perfect' ? 'perfect' : 'hit', { gain: 0.6 });
        }
      } else if (ev.kind === 'rel') {
        run.onRel(ev.c, ev.delta, t);
        run.values[ev.c] = ((run.values[ev.c] ?? 0) + ev.delta * 0.1) % (Math.PI * 2);
      }
      if (!run.active) draw();
    }),
    app.on('midi', ({ ev, mapped }) => {
      if (!run?.active) stage.next.textContent = `${mapped ? names[mapped] ?? mapped : 'unmapped'} · ${ev.key}`;
    }),
    app.on('map', () => {
      draw();
      loadDrill(drill!);
    }),
    app.on('clock', (clock) => {
      const snap = clock.snapshot();
      if (app.settings.followMidiClock && snap.bpm && run && Math.abs(snap.bpm - Number(bpmInput.value)) > 0.05) {
        bpmInput.value = String(snap.bpm);
        run.setBpm(snap.bpm * app.settings.tempoScale, performance.now());
      }
      if (snap.bpm && run?.active) {
        const drift = MidiClock.driftMs(snap.beat, run.pos(performance.now()), run.bpm);
        stage.next.textContent = `MIDI clock ${snap.bpm} BPM · drift ${Math.round(drift)} ms`;
      }
    }),
    app.on('settings', () => {
      renderer.setTheme(highwayThemeFromCss());
      renderer.setReducedMotion(app.reducedMotion);
      renderer.setFov(app.settings.fov);
      draw();
    }),
  );
  const onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag) || app.learn?.isOpen) return;
    lastPointerMove = performance.now();
    rail.classList.remove('dim');
    if (e.code === 'Space') {
      e.preventDefault();
      startStop();
    } else if (e.key.toLowerCase() === 'e' && run?.perf) {
      if (run.activateEuphoria(performance.now())) {
        renderer.pushEvent({ kind: 'euphoria' }, frameOf(performance.now()), performance.now());
        app.sfx.play('euphoria');
      }
    } else if (e.key === 'ArrowRight' && e.altKey) step(1);
    else if (e.key === 'ArrowLeft' && e.altKey) step(-1);
  };
  document.addEventListener('keydown', onKey);
  const onMove = () => {
    lastPointerMove = performance.now();
    rail.classList.remove('dim');
  };
  document.addEventListener('pointermove', onMove);
  const resize = () => {
    const { w, h, dpr } = stage.fit(0.52);
    renderer.resize(w, h, dpr);
    draw();
  };
  window.addEventListener('resize', resize);

  loadDrill(drill);
  resize();
  void document.fonts?.ready.then(() => draw());
  const due = dueToday(app.attempts);
  if (due.length && !params.id) app.toast(`${due.length} drill${due.length > 1 ? 's' : ''} due for review today.`);
  if (testMode && params.query.get('autostart') === '1') startStop();

  (window as unknown as { __practice: unknown }).__practice = {
    run: () => run,
    startedAt: () => startedAt,
    start: startStop,
    finish: () => {
      if (!run) return;
      if (!run.active) run.start(performance.now());
      run.stop(performance.now());
      return finishRun();
    },
    loadDrill: (id: string) => {
      const d = app.drill(id);
      if (d) loadDrill(d);
    },
    renderer,
    /** Render n frames spread over the drill and return the mean draw time in ms. */
    benchmark: (n = 200) => {
      if (!run) return null;
      if (run.phase === 'idle') run.start(performance.now());
      const total = lengthBeats(drill!);
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        const pos = (total * i) / n;
        const t = startedAt + (pos * 60000) / run.bpm;
        run.tick(t);
        renderer.draw(frameOf(t), t);
      }
      return (performance.now() - t0) / n;
    },
  };

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(placementTimer);
    offs.forEach((f) => f());
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('pointermove', onMove);
    window.removeEventListener('resize', resize);
    ctlOff?.();
    stage.destroy();
  };
};
