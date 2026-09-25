import {
  DrillRun, LaneRenderer, TapTempo, themeFromCss, resolveThresholds, availability, lengthBeats, dueToday, MidiClock,
  type Drill, type RunStats, type AttemptRecord,
} from '@midi-trainer/engine';
import type { App, ControlEvent } from '../app';
import type { View } from '../router';
import { navigate } from '../router';
import { tierRank } from '../content';
import { $, el } from '../ui/dom';
import { md } from '../ui/markdown';
import { createStage } from '../ui/stage';
import { createController } from '../ui/controller';

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
    root.appendChild(el('p', {}, 'No drills available.'));
    return;
  }
  const s = app.settings;
  let run: DrillRun | null = null;
  let raf = 0;
  let startedAt = 0;
  let section: [number, number] | null = drill.section ?? null;
  const tapTempo = new TapTempo();
  const offs: Array<() => void> = [];

  // ---------- layout ----------
  const toolbar = el('div', { class: 'toolbar' });
  const nav = el('div', { class: 'group' });
  const prevBtn = el('button', { id: 'prevDrill', title: 'Previous drill' }, '←');
  const nextBtn = el('button', { id: 'nextDrill', title: 'Next drill' }, '→');
  const browseBtn = el('button', { id: 'browseBtn' }, 'All drills');
  nav.append(prevBtn, nextBtn, browseBtn);
  const bpmGroup = el('div', { class: 'group' });
  const bpmLabel = el('label', { for: 'bpm' }, 'BPM');
  const bpmInput = el('input', { type: 'number', id: 'bpm', min: '20', max: '400', value: String(drill.bpm) });
  const tapBtn = el('button', { id: 'tapTempo' }, 'Tap tempo');
  const tempoLabel = el('label', { for: 'tempo' }, 'Tempo');
  const tempoRange = el('input', { type: 'range', id: 'tempo', min: '50', max: '110', step: '10', value: String(Math.round(s.tempoScale * 100)) });
  const tempoVal = el('span', { id: 'tempoVal' }, `${Math.round(s.tempoScale * 100)}%`);
  bpmGroup.append(bpmLabel, bpmInput, tapBtn, tempoLabel, tempoRange, tempoVal);
  const toggles = el('div', { class: 'group' });
  const mkToggle = (id: string, text: string, on: boolean) => {
    const b = el('button', { id }, text);
    b.classList.toggle('on', on);
    toggles.appendChild(b);
    return b;
  };
  const clickBtn = mkToggle('clickBtn', 'Metronome', s.click);
  const loopBtn = mkToggle('loopBtn', 'Loop', s.loop);
  const waitBtn = mkToggle('waitBtn', 'Wait mode', s.waitMode);
  const perfBtn = mkToggle('perfBtn', 'Performance', s.performanceMode);
  const masterBtn = mkToggle('masterBtn', 'Master mode', s.masterMode);
  const ghostBtn = mkToggle('ghostBtn', 'Ghost', s.showGhost);
  const ctlBtn = mkToggle('ctlBtn', 'On-screen controller', s.showController);
  const isoSeg = el('div', { class: 'seg', id: 'isoSeg' });
  for (const [v, t] of [['all', 'All'], ['A', 'Deck A'], ['B', 'Deck B'], ['mixer', 'Mixer']] as const) {
    const b = el('button', { 'data-v': v }, t);
    b.classList.toggle('on', s.isolation === v);
    isoSeg.appendChild(b);
  }
  const secGroup = el('div', { class: 'group' });
  const secLabel = el('label', {}, 'Section bars');
  const secFrom = el('input', { type: 'number', id: 'secFrom', min: '1', value: section ? String(section[0]) : '', placeholder: 'from' });
  const secTo = el('input', { type: 'number', id: 'secTo', min: '1', value: section ? String(section[1]) : '', placeholder: 'to' });
  const secClear = el('button', { class: 'small', id: 'secClear' }, 'whole drill');
  secGroup.append(secLabel, secFrom, secTo, secClear);
  const transport = el('div', { class: 'group' });
  const playBtn = el('button', { class: 'primary', id: 'playBtn' }, 'Start');
  const resetBtn = el('button', { id: 'resetBtn' }, 'Restart');
  transport.append(playBtn, resetBtn);
  toolbar.append(nav, bpmGroup, toggles, isoSeg, secGroup, transport);
  root.appendChild(toolbar);

  const stage = createStage(root);
  const renderer = new LaneRenderer(stage.ctx, themeFromCss());
  const below = el('div', { class: 'below' });
  const lessonCard = el('div', { class: 'card', id: 'lesson' });
  const statsCard = el('div', { class: 'card' });
  statsCard.innerHTML = `<h2>This run</h2>
    <div class="stats">
      <div class="stat"><b id="sScore">—</b><span>score</span></div>
      <div class="stat"><b id="sTiming">—</b><span>avg timing (ms)</span></div>
      <div class="stat"><b id="sTrack">—</b><span>tracking</span></div>
      <div class="stat"><b id="sBest">—</b><span>best</span></div>
    </div>
    <div class="tiers" id="tiers"><span class="t-perfect">Perfect <b>0</b></span><span class="t-great">Great <b>0</b></span><span class="t-ok">OK <b>0</b></span><span class="t-miss">Miss <b>0</b></span><span class="t-extra">Extra <b>0</b></span><span class="t-tech">Technique <b>—</b></span></div>
    <div class="legend"><span><i style="background:var(--tap)"></i>tap on the line</span><span><i style="background:var(--ramp)"></i>ride the path</span><span><i style="background:var(--ok)"></i>hit</span><span><i style="background:var(--bad)"></i>miss</span></div>
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
  const bpb = () => drill!.timeSig?.[0] ?? 4;

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

  function newRun(): void {
    const st = app.settings;
    const d = drill!;
    const thresholds = resolveThresholds(d, st.thresholds);
    run = new DrillRun(d, {
      thresholds,
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
    });
    const only = onlyLanes();
    if (only) {
      run = new DrillRun(d, {
        thresholds, strictness: st.strictness, inputOffsetMs: st.inputOffsetMs, countInBars: st.countInBars, loop: st.loop, initialValues: app.values, kinds,
        tempoScale: st.tempoScale, section, waitMode: st.waitMode, mode: st.performanceMode ? 'performance' : 'lesson', onlyLanes: only,
      });
    }
    const bpmOverride = Number(bpmInput.value);
    if (bpmOverride && bpmOverride !== d.bpm) run.setBpm(bpmOverride * st.tempoScale, performance.now());
    playBtn.textContent = 'Start';
    stage.cue.style.display = 'none';
    stage.result.style.display = 'none';
    stage.perf.style.display = st.performanceMode ? 'block' : 'none';
    updateStats();
    draw();
  }

  function loadDrill(d: Drill): void {
    drill = d;
    section = d.section ?? null;
    secFrom.value = section ? String(section[0]) : '';
    secTo.value = section ? String(section[1]) : '';
    bpmInput.value = String(d.bpm);
    stage.title.textContent = d.name;
    const av = availability(d, app.mapped(), { capabilities: new Set(app.profile.capabilities) });
    const reasons = av.reasons.map((r) => (r.kind === 'unmapped' ? `Unmapped: ${r.controls.map((c) => names[c] ?? c).join(', ')}. Open Map controls.` : r.kind === 'needsAudio' ? 'Needs the audio decks (open Decks and load two tracks).' : `Needs hardware this profile lacks: ${r.hardware.join(', ')}.`));
    lessonCard.innerHTML = md(d.lesson || '## Loaded drill\n\nCustom drill from file.') + (d.sources?.length ? `<h3>Sources</h3><p>${d.sources.map((u) => `<a href="${u}" target="_blank" rel="noopener">${new URL(u).hostname}</a>`).join(' · ')}</p>` : '') + (d.artist ? `<p class="hint">Technique attributed to ${d.artist} by the sources above.</p>` : '') + (reasons.length ? `<p class="hint">${reasons.join(' ')}</p>` : '');
    $('hint').textContent = `${d.bars} bars at ${d.bpm} BPM · ${d.tier}${d.path ? ` · ${d.path} L${d.level ?? '?'}` : ''}. Play A (or Space) on a phrase downbeat starts the clock.`;
    void app.saveSettings({ lastDrill: d.id });
    location.hash = `#/practice/${encodeURIComponent(d.id)}`;
    newRun();
    renderExplain();
  }

  function renderExplain(): void {
    const host = $('explain');
    host.innerHTML = '';
    for (const c of run!.lanes) {
      const chip = el('div', { class: 'chip', 'data-chip': c });
      chip.appendChild(el('span', {}, names[c] ?? c));
      chip.appendChild(el('b', {}, kinds[c] === 'cc' ? `${Math.round((app.values[c] ?? 0) * 100)}%` : kinds[c] === 'rel' ? 'jog' : 'press it'));
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

  function startStop(): void {
    if (!run) return;
    app.sounds.ensure();
    const now = performance.now();
    if (run.active) {
      run.stop(now);
      playBtn.textContent = 'Start';
      cancelAnimationFrame(raf);
      return;
    }
    if (run.phase === 'finished' || run.phase === 'failed') newRun();
    startedAt = now;
    run!.start(now);
    playBtn.textContent = 'Stop';
    stage.result.style.display = 'none';
    loop();
  }

  function loop(): void {
    cancelAnimationFrame(raf);
    if (!run || !run.active) return;
    const now = performance.now();
    const r = run.tick(now);
    if (app.settings.click) for (const b of r.beats) if (b >= 0) app.sounds.click(b % bpb() === 0);
    const pos = run.pos(now);
    const cue = run.cue(pos, names);
    if (r.waiting) {
      stage.cue.style.display = 'block';
      stage.cue.textContent = `Press ${cue ? cue.text.replace(/^Tap /, '').replace(/ in \d+ beats$/, '') : 'the highlighted control'}`;
    } else if (cue) {
      stage.cue.style.display = 'block';
      stage.cue.textContent = cue.text;
    } else stage.cue.style.display = 'none';
    updateStats();
    draw();
    if (r.ended) {
      playBtn.textContent = 'Start';
      stage.cue.style.display = 'none';
      void finishRun();
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  async function finishRun(): Promise<void> {
    if (!run || !drill) return;
    const attempt = run.attempt(app.profile.id);
    const res = await app.addAttempt(attempt);
    const box = stage.result;
    box.innerHTML = '';
    box.appendChild(el('small', {}, drill.name + (run.phase === 'failed' ? ' · energy ran out' : '')));
    box.appendChild(el('b', {}, attempt.score == null ? '—' : `${attempt.score}%`));
    const medal = attempt.medal;
    box.appendChild(el('div', { class: `medal ${medal ? 'medal-' + medal : ''}` }, medal ? medal : attempt.passed ? 'passed' : 'keep going'));
    if (attempt.perf) box.appendChild(el('small', {}, `${attempt.perf.points.toLocaleString()} pts · ${'★'.repeat(attempt.perf.stars)} · max combo ${attempt.perf.maxCombo}`));
    box.appendChild(el('small', {}, `${res.isPb ? 'New personal best · ' : ''}+${res.xp} XP${res.leveledUp ? ` · Level ${res.level}!` : ''}`));
    box.appendChild(el('small', {}, res.streak.todayMet ? `Daily goal met · ${res.streak.current}-day streak` : `${Math.max(0, Math.ceil(app.settings.goalMinutes - res.streak.todayMinutes))} min to today's goal`));
    const actions = el('div', { class: 'row', style: 'justify-content:center' });
    const again = el('button', { class: 'small' }, 'Again');
    again.onclick = () => {
      newRun();
      startStop();
    };
    const hist = el('button', { class: 'small' }, 'History');
    hist.onclick = () => navigate(`history/${encodeURIComponent(drill!.id)}`);
    const next = el('button', { class: 'small primary' }, 'Next drill');
    next.onclick = () => step(1);
    actions.append(again, hist, next);
    box.appendChild(actions);
    box.style.display = 'block';
    updateStats();
    if (params.query.get('placement')) {
      setTimeout(() => navigate(`placement?score=${attempt.score ?? 'null'}`), 1200);
      return;
    }
    // Auto-BPM ladder
    if (app.settings.autoBpm && attempt.passed && app.settings.tempoScale < 1) {
      const nextScale = Math.min(1, Math.round((app.settings.tempoScale + 0.1) * 10) / 10);
      await app.saveSettings({ tempoScale: nextScale });
      tempoRange.value = String(Math.round(nextScale * 100));
      tempoVal.textContent = `${Math.round(nextScale * 100)}%`;
      app.toast(`Clean at ${Math.round((nextScale - 0.1) * 100)}%. Tempo up to ${Math.round(nextScale * 100)}%.`);
    } else if (app.settings.autoBpm && attempt.medal === 'gold' && app.settings.tempoScale >= 1) {
      app.toast('Gold at full tempo. Try the next drill in the path.');
    }
    if (app.settings.masterMode && goldCount() === 3) app.toast('Three golds: the highway is hidden from now on. Play from memory.');
  }

  function updateStats(): void {
    if (!run || !drill) return;
    const st: RunStats = run.stats();
    $('sScore').textContent = st.score == null ? '—' : `${st.score}%`;
    $('sTiming').textContent = st.timingMeanMs == null ? '—' : `${st.timingMeanMs}${st.timingBiasMs != null ? ` (${st.timingBiasMs > 0 ? '+' : ''}${st.timingBiasMs})` : ''}`;
    $('sTrack').textContent = st.sub.tracking == null ? '—' : `${st.sub.tracking}%`;
    const best = app.best[drill.id];
    $('sBest').textContent = best == null ? '—' : `${best}%`;
    const tiers = $('tiers').querySelectorAll('b');
    tiers[0]!.textContent = String(st.tiers.perfect);
    tiers[1]!.textContent = String(st.tiers.great);
    tiers[2]!.textContent = String(st.tiers.ok);
    tiers[3]!.textContent = String(st.tiers.miss);
    tiers[4]!.textContent = String(run.extraPresses);
    tiers[5]!.textContent = st.sub.technique == null ? '—' : `${st.sub.technique}%`;
    const pos = run.pos(performance.now());
    const bb = run.transport.barBeat(pos);
    const total = Math.ceil(lengthBeats(drill) / bpb());
    stage.barinfo.textContent =
      run.phase === 'idle' || run.phase === 'finished' || run.phase === 'failed'
        ? `Waiting for ${names[app.settings.autoStartControl] ?? 'Start'} · ${total} bars at ${Math.round(run.bpm * 10) / 10} BPM${section ? ` · section ${section[0]}–${section[1]}` : ''}`
        : pos < (section ? (section[0] - 1) * bpb() : 0)
          ? `Count-in · ${Math.ceil((section ? (section[0] - 1) * bpb() : 0) - pos)}`
          : `Bar ${bb.bar} of ${total} · beat ${bb.beat}`;
    if (run.perf) {
      const p = run.perf.snapshot();
      stage.perf.innerHTML = `<div class="mult">${p.multiplier}×</div><div>${p.points.toLocaleString()} pts · combo ${p.combo}</div><div>${'⚡'.repeat(p.euphoriaCharge)}${p.euphoriaActiveUntil != null ? ' EUPHORIA' : p.euphoriaCharge ? ' press E' : ''}</div><div class="energy"><i style="width:${Math.round(p.energy * 100)}%"></i></div>`;
    }
  }

  function draw(): void {
    if (!run) return;
    const fade = app.settings.masterMode && goldCount() >= 3 ? 1 : 0;
    renderer.draw({
      lanes: run.lanes,
      states: run.states,
      values: run.values,
      flashes: run.flashes,
      names,
      kinds,
      mapped: app.mapped(),
      pos: run.pos(performance.now()),
      hitWindowBeats: app.settings.showHitWindow ? run.thresholds.tapWindowBeats : undefined,
      fade,
      ghost: ghostLog(),
    });
    if (!run.active && Object.keys(run.flashes).length) requestAnimationFrame(draw);
  }

  function step(dir: 1 | -1): void {
    const i = ordered.findIndex((d) => d.id === drill!.id);
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
    if (bpm) {
      bpmInput.value = String(bpm);
      run?.setBpm(bpm * app.settings.tempoScale, performance.now());
    }
  };
  tempoRange.oninput = () => {
    const scale = Number(tempoRange.value) / 100;
    tempoVal.textContent = `${tempoRange.value}%`;
    void app.saveSettings({ tempoScale: scale }).then(() => {
      if (run && !run.active) newRun();
      else run?.setBpm((Number(bpmInput.value) || drill!.bpm) * scale, performance.now());
    });
  };
  const toggle = (b: HTMLButtonElement, key: 'click' | 'loop' | 'waitMode' | 'performanceMode' | 'masterMode' | 'showGhost' | 'showController', after?: () => void) => {
    b.onclick = () => {
      const v = !app.settings[key];
      b.classList.toggle('on', v);
      void app.saveSettings({ [key]: v } as Partial<typeof app.settings>).then(() => {
        if (key === 'click') app.sounds.ensure();
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
    const b = Number(secTo.value);
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

  offs.push(
    app.on('control', (ev) => {
      updateExplain(ev);
      if (!run) return;
      if (ev.kind === 'midi' as never) return;
      if (ev.kind === 'tap') {
        if (!run.active && app.settings.autoStart && ev.c === app.settings.autoStartControl) {
          startStop();
          return;
        }
        run.onTap(ev.c, ev.timeStamp);
        updateStats();
      } else if (ev.kind === 'cc') run.onValue(ev.c, ev.value, ev.timeStamp);
      else if (ev.kind === 'rel') {
        run.onRel(ev.c, ev.delta, ev.timeStamp);
        run.values[ev.c] = ((run.values[ev.c] ?? 0) + ev.delta * 0.1) % (Math.PI * 2);
      }
      if (!run.active) draw();
    }),
    app.on('midi', ({ ev, mapped }) => {
      const valText = ev.kind === 'cc' ? ` · ${Math.round(ev.value * 100)}%` : '';
      stage.lastin.textContent = `${mapped ? names[mapped] ?? mapped : 'unmapped'} · ${ev.key}${valText}`;
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
        stage.lastin.textContent = `MIDI clock ${snap.bpm} BPM · drift ${Math.round(drift)} ms`;
      }
    }),
  );
  const onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag) || app.learn?.isOpen) return;
    if (e.code === 'Space') {
      e.preventDefault();
      startStop();
    } else if (e.key.toLowerCase() === 'e' && run?.perf) {
      if (run.activateEuphoria(performance.now())) app.toast('Euphoria!');
    } else if (e.key === 'ArrowRight' && e.altKey) step(1);
    else if (e.key === 'ArrowLeft' && e.altKey) step(-1);
  };
  document.addEventListener('keydown', onKey);
  const resize = () => {
    const { w, h } = stage.fit();
    renderer.resize(w, h);
    draw();
  };
  window.addEventListener('resize', resize);
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const onTheme = () => {
    renderer.setTheme(themeFromCss());
    draw();
  };
  mq.addEventListener('change', onTheme);
  offs.push(app.on('settings', onTheme));

  loadDrill(drill);
  resize();
  const due = dueToday(app.attempts);
  if (due.length && !params.id) app.toast(`${due.length} drill${due.length > 1 ? 's' : ''} due for review today. See Drills.`);

  // test hook
  (window as unknown as { __practice: unknown }).__practice = {
    run: () => run,
    startedAt: () => startedAt,
    start: startStop,
    loadDrill: (id: string) => {
      const d = app.drill(id);
      if (d) loadDrill(d);
    },
  };

  return () => {
    cancelAnimationFrame(raf);
    offs.forEach((f) => f());
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', resize);
    mq.removeEventListener('change', onTheme);
    ctlOff?.();
    stage.destroy();
  };
};
