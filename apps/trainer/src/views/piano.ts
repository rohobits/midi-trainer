import { NoteRun, KeyboardRenderer, keyboardThemeFromCss, resolveThresholds, parseMidiFile, noteName, noteAt, type Drill, type Hand, type NoteMode } from '@midi-trainer/engine';
import type { View } from '../router';
import { navigate } from '../router';
import { $, el } from '../ui/dom';
import { md } from '../ui/markdown';
import { createStage } from '../ui/stage';
import { showResults, hideResults } from '../ui/results';
import { icon } from '../ui/icons';

function isNoteDrill(d: Drill): boolean {
  return d.targets.some((t) => t.type === 'note');
}

export const pianoView: View = (root, app, params) => {
  const exercises = () => app.drills.filter(isNoteDrill);
  let drill: Drill | undefined = exercises().find((d) => d.id === params.id) ?? exercises()[0];
  if (!drill) {
    root.appendChild(el('p', { class: 'hint' }, 'No piano exercises available.'));
    return;
  }
  const s = app.settings;
  let run: NoteRun | null = null;
  let raf = 0;
  const offs: Array<() => void> = [];

  const rail = el('div', { class: 'rail' });
  const exGroup = el('div', { class: 'group' });
  const exSel = el('select', { id: 'ex', 'aria-label': 'Exercise' });
  const fill = () => {
    exSel.innerHTML = '';
    for (const e of exercises()) exSel.appendChild(el('option', { value: e.id }, e.name));
    exSel.value = drill!.id;
  };
  fill();
  const midFile = el('span', { class: 'file' });
  midFile.appendChild(el('button', { type: 'button', class: 'small' }, 'Load .mid'));
  const midInput = el('input', { type: 'file', id: 'midfile', accept: '.mid,.midi' });
  midFile.appendChild(midInput);
  exGroup.append(exSel, midFile);
  const modeSeg = el('div', { class: 'seg', id: 'modeSeg' });
  for (const [v, t] of [['wait', 'Wait for me'], ['play', 'Play along']] as const) {
    const b = el('button', { 'data-v': v }, t);
    b.classList.toggle('on', s.noteMode === v);
    modeSeg.appendChild(b);
  }
  const handSeg = el('div', { class: 'seg', id: 'handSeg' });
  for (const [v, t] of [['B', 'Both'], ['R', 'Right'], ['L', 'Left']] as const) {
    const b = el('button', { 'data-v': v }, t);
    b.classList.toggle('on', s.hand === v);
    handSeg.appendChild(b);
  }
  const tempoGroup = el('div', { class: 'group' });
  const bpmRange = el('input', { type: 'range', id: 'bpm', min: '30', max: '180', value: String(drill.bpm), 'aria-label': 'Tempo' });
  const bpmVal = el('span', { id: 'bpmv', class: 'mono' }, String(drill.bpm));
  tempoGroup.append(el('label', { for: 'bpm' }, 'Tempo'), bpmRange, bpmVal);
  const barGroup = el('div', { class: 'group' });
  const barInput = el('input', { type: 'number', id: 'bar', min: '1', value: '1', style: 'width:64px', 'aria-label': 'Start bar' });
  const toggles = el('div', { class: 'seg' });
  const loopBtn = el('button', { id: 'loopBtn' }, 'Loop');
  const guideBtn = el('button', { id: 'guideBtn' }, 'Guide');
  const clickBtn = el('button', { id: 'clickBtn' }, 'Click');
  loopBtn.classList.toggle('on', s.loop);
  guideBtn.classList.toggle('on', s.guide);
  clickBtn.classList.toggle('on', s.click);
  toggles.append(loopBtn, guideBtn, clickBtn);
  barGroup.append(el('label', { for: 'bar' }, 'Bar'), barInput, toggles);
  const transport = el('div', { class: 'group', style: 'margin-left:auto' });
  const playBtn = el('button', { class: 'primary', id: 'playBtn' }, 'Start');
  const resetBtn = el('button', { id: 'resetBtn', title: 'Restart' });
  resetBtn.appendChild(icon('restart'));
  transport.append(playBtn, resetBtn);
  rail.append(exGroup, modeSeg, handSeg, tempoGroup, barGroup, transport);
  root.appendChild(rail);
  const stage = createStage(root);
  const renderer = new KeyboardRenderer(stage.ctx, keyboardThemeFromCss());
  renderer.setReducedMotion(app.reducedMotion);
  const below = el('div', { class: 'below' });
  const lessonCard = el('div', { class: 'panel', id: 'lesson' });
  const statsCard = el('div', { class: 'panel' });
  statsCard.innerHTML = `<h2>This run</h2>
    <div class="stats">
      <div class="stat"><b id="sAcc">—</b><span>accuracy</span></div>
      <div class="stat"><b id="sWrong">0</b><span>wrong</span></div>
      <div class="stat"><b id="sMiss">0</b><span>missed</span></div>
      <div class="stat"><b id="sBest">—</b><span>best</span></div>
    </div>
    <div class="legend"><span><i style="background:var(--rh)"></i>right hand</span><span><i style="background:var(--lh)"></i>left hand</span><span><i style="background:var(--perfect)"></i>correct</span><span><i style="background:var(--miss)"></i>wrong key</span></div>
    <p class="hint">Keyboard on USB or Bluetooth MIDI. Click on-screen keys to test without one. <kbd>Space</kbd> starts and pauses.</p>
    <p class="hint"><a href="#/browse?profile=piano88">All piano exercises</a></p>`;
  below.append(lessonCard, statsCard);
  root.appendChild(below);

  function newRun(): void {
    const st = app.settings;
    run = new NoteRun(drill!, {
      thresholds: resolveThresholds(drill!, st.thresholds),
      strictness: st.strictness,
      inputOffsetMs: st.inputOffsetMs,
      mode: st.noteMode as NoteMode,
      hand: st.hand as Hand,
      loop: st.loop,
      startBar: Number(barInput.value) || 1,
    });
    run.setBpm(Number(bpmRange.value) || drill!.bpm, performance.now());
    renderer.effects.clear();
    playBtn.textContent = 'Start';
    stage.msg.style.display = 'none';
    hideResults(stage.results);
    updateStats();
    draw();
  }

  function loadDrill(d: Drill): void {
    drill = d;
    bpmRange.value = String(d.bpm);
    bpmVal.textContent = String(d.bpm);
    barInput.value = '1';
    barInput.max = String(Math.ceil(Math.max(...d.targets.map((t) => (t.type === 'note' ? t.t + t.d : 0)), 4) / 4));
    stage.name.textContent = d.name;
    lessonCard.innerHTML = md(d.lesson || '## Loaded file\n\nHands were split by track (or at middle C if the file has one track). Right hand in cyan, left in amber.');
    location.hash = `#/piano/${encodeURIComponent(d.id)}`;
    newRun();
  }

  function togglePlay(): void {
    if (!run) return;
    app.unlockAudio();
    const now = performance.now();
    if (run.active) {
      run.pause(now);
      playBtn.textContent = 'Start';
      stage.msg.style.display = 'none';
      cancelAnimationFrame(raf);
      return;
    }
    if (run.phase === 'finished') newRun();
    if (run!.phase === 'idle' && run!.inputLog.length === 0) run!.start(now);
    else run!.resume(now);
    playBtn.textContent = 'Pause';
    hideResults(stage.results);
    loop();
  }

  function loop(): void {
    cancelAnimationFrame(raf);
    if (!run || !run.active) return;
    const now = performance.now();
    const r = run.tick(now);
    if (app.settings.click) for (const b of r.beats) if (b >= 0) app.sounds.click(b % 4 === 0, 1400);
    if (app.settings.guide) for (const n of r.guide) app.sounds.tone(n.n, (n.d * 60) / run.bpm);
    stage.msg.style.display = r.waiting ? 'block' : 'none';
    stage.msg.textContent = 'Play the highlighted keys';
    updateStats();
    draw();
    if (r.ended) {
      playBtn.textContent = 'Start';
      stage.msg.style.display = 'none';
      void finishRun();
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  async function finishRun(): Promise<void> {
    if (!run || !drill) return;
    const attempt = run.attempt();
    const res = await app.addAttempt(attempt);
    showResults(stage.results, {
      drill,
      attempt,
      isPb: res.isPb,
      prevBest: res.isPb ? null : (app.best[drill.id] ?? null),
      xp: res.xp,
      leveledUp: res.leveledUp,
      level: res.level,
      streakLine: res.streak.todayMet ? `Daily goal met · ${res.streak.current}-day streak` : `${Math.max(0, Math.ceil(app.settings.goalMinutes - res.streak.todayMinutes))} min to today's goal`,
      reduced: app.reducedMotion,
      sfx: app.sfx,
      onAgain: () => {
        newRun();
        togglePlay();
      },
      onSlower: () => {
        bpmRange.value = String(Math.max(30, Math.round(Number(bpmRange.value) * 0.9)));
        bpmVal.textContent = bpmRange.value;
        newRun();
        togglePlay();
      },
      onNext: () => {
        const list = exercises();
        const i = list.findIndex((d) => d.id === drill!.id);
        const n = list[(i + 1) % list.length];
        if (n) {
          exSel.value = n.id;
          loadDrill(n);
        }
      },
      onHistory: () => navigate(`history/${encodeURIComponent(drill!.id)}`),
    });
    updateStats();
  }

  function updateStats(): void {
    if (!run || !drill) return;
    const acc = run.accuracy();
    $('sAcc').textContent = acc == null ? '—' : `${acc}`;
    $('sWrong').textContent = String(run.wrong);
    $('sMiss').textContent = String(run.missed);
    const best = app.best[drill.id];
    $('sBest').textContent = best == null ? '—' : `${best}`;
    stage.score.textContent = acc == null ? '—' : `${acc}`;
    stage.acc.textContent = `${run.correct} right · ${run.wrong} wrong`;
    const pos = run.pos(performance.now());
    const bb = run.transport.barBeat(pos);
    stage.sub.textContent = `bar ${bb.bar} of ${run.bars} · beat ${bb.beat} · ${run.mode === 'wait' ? 'wait for me' : 'play along'}`;
    const next = run.nextDue(pos);
    stage.next.innerHTML = next.length ? `next <b>${next.map((n) => noteName(n.n)).join(' + ')}</b>` : 'done';
    const total = run.length;
    const ticks: { at: number; phrase: boolean }[] = [];
    for (let b = 4; b < total; b += 4) ticks.push({ at: b / total, phrase: b % 32 === 0 });
    stage.setProgress(Math.max(0, pos) / total, ticks);
  }

  function draw(): void {
    if (!run) return;
    const now = performance.now();
    const pos = run.pos(now);
    renderer.draw({ states: run.states, pos, hand: run.hand, pressed: run.pressed, flashes: run.flashes, expected: run.expected(pos), waiting: run.waiting }, now);
    if (!run.active && renderer.effects.busy) requestAnimationFrame(draw);
  }

  exSel.onchange = () => {
    const d = app.drill(exSel.value);
    if (d) loadDrill(d);
  };
  midInput.onchange = async (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    try {
      const parsed = parseMidiFile(new Uint8Array(await f.arrayBuffer()), f.name);
      const id = `mid-${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
      const d: Drill = { id, version: 1, name: `File · ${f.name}`, tier: 'Custom', profile: 'piano88', bpm: parsed.bpm, bars: Math.ceil(Math.max(...parsed.notes.map((n) => n.t + n.d), 4) / 4), targets: parsed.notes, lesson: '' };
      await app.addDrill(d, 'imported');
      fill();
      loadDrill(d);
    } catch (err) {
      app.toast('Could not read that MIDI file: ' + (err as Error).message, 4000);
    }
    input.value = '';
  };
  modeSeg.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.onclick = () => {
    modeSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    void app.saveSettings({ noteMode: b.dataset.v as NoteMode }).then(newRun);
  }));
  handSeg.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.onclick = () => {
    handSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    void app.saveSettings({ hand: b.dataset.v as Hand }).then(newRun);
  }));
  bpmRange.oninput = () => {
    bpmVal.textContent = bpmRange.value;
    run?.setBpm(Number(bpmRange.value), performance.now());
  };
  barInput.onchange = newRun;
  const toggle = (b: HTMLButtonElement, key: 'loop' | 'guide' | 'click') => {
    b.onclick = () => {
      const v = !app.settings[key];
      b.classList.toggle('on', v);
      void app.saveSettings({ [key]: v } as Partial<typeof app.settings>).then(() => {
        if (key !== 'loop') app.unlockAudio();
        else if (run && !run.active) newRun();
      });
    };
  };
  toggle(loopBtn, 'loop');
  toggle(guideBtn, 'guide');
  toggle(clickBtn, 'click');
  playBtn.onclick = togglePlay;
  resetBtn.onclick = newRun;
  offs.push(
    app.on('control', (ev) => {
      if (!run) return;
      if (ev.kind === 'noteon') {
        const j = run.noteOn(ev.note, ev.timeStamp);
        renderer.noteEvent(ev.note, j.tier, j.target?.errMs ?? null, !!j.target, performance.now());
        if (run.active) app.sfx.play(j.target ? (j.tier === 'perfect' ? 'perfect' : 'hit') : 'miss', { gain: 0.45 });
        updateStats();
        if (!run.active) draw();
      } else if (ev.kind === 'noteoff') {
        run.noteOff(ev.note, ev.timeStamp);
        if (!run.active) draw();
      }
    }),
    app.on('settings', () => {
      renderer.setTheme(keyboardThemeFromCss());
      renderer.setReducedMotion(app.reducedMotion);
      draw();
    }),
  );
  let mouseNote: number | null = null;
  stage.canvas.addEventListener('pointerdown', (e) => {
    app.unlockAudio();
    const r = stage.canvas.getBoundingClientRect();
    const n = noteAt(e.clientX - r.left, e.clientY - r.top, renderer.metrics);
    if (n != null && run) {
      mouseNote = n;
      const j = run.noteOn(n, performance.now());
      renderer.noteEvent(n, j.tier, j.target?.errMs ?? null, !!j.target, performance.now());
      app.sounds.tone(n, 0.4);
      updateStats();
      draw();
    }
  });
  const up = () => {
    if (mouseNote != null && run) {
      run.noteOff(mouseNote, performance.now());
      mouseNote = null;
      draw();
    }
  };
  window.addEventListener('pointerup', up);
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) && !app.learn?.isOpen) {
      e.preventDefault();
      togglePlay();
    }
  };
  document.addEventListener('keydown', onKey);
  const resize = () => {
    const { w, h } = stage.fit(0.44);
    renderer.resize(w, h);
    draw();
  };
  window.addEventListener('resize', resize);
  loadDrill(drill);
  resize();
  void document.fonts?.ready.then(() => draw());
  (window as unknown as { __piano: unknown }).__piano = { run: () => run, start: togglePlay };
  return () => {
    cancelAnimationFrame(raf);
    offs.forEach((f) => f());
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('resize', resize);
    stage.destroy();
  };
};
