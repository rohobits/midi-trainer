import { NoteRun, KeyboardRenderer, keyboardThemeFromCss, resolveThresholds, parseMidiFile, noteName, noteAt, type Drill, type Hand, type NoteMode } from '@midi-trainer/engine';
import type { View } from '../router';
import { navigate } from '../router';
import { $, el } from '../ui/dom';
import { md } from '../ui/markdown';
import { createStage } from '../ui/stage';

function isNoteDrill(d: Drill): boolean {
  return d.targets.some((t) => t.type === 'note');
}

export const pianoView: View = (root, app, params) => {
  const exercises = () => app.drills.filter(isNoteDrill);
  let drill: Drill | undefined = exercises().find((d) => d.id === params.id) ?? exercises()[0];
  if (!drill) {
    root.appendChild(el('p', {}, 'No piano exercises available.'));
    return;
  }
  const s = app.settings;
  let run: NoteRun | null = null;
  let raf = 0;
  const offs: Array<() => void> = [];

  const toolbar = el('div', { class: 'toolbar' });
  const exGroup = el('div', { class: 'group' });
  const exSel = el('select', { id: 'ex' });
  const fill = () => {
    exSel.innerHTML = '';
    for (const e of exercises()) exSel.appendChild(el('option', { value: e.id }, e.name));
    exSel.value = drill!.id;
  };
  fill();
  const midFile = el('span', { class: 'file' });
  midFile.appendChild(el('button', { type: 'button' }, 'Load .mid'));
  const midInput = el('input', { type: 'file', id: 'midfile', accept: '.mid,.midi' });
  midFile.appendChild(midInput);
  exGroup.append(el('label', { for: 'ex' }, 'Exercise'), exSel, midFile);
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
  const bpmRange = el('input', { type: 'range', id: 'bpm', min: '30', max: '180', value: String(drill.bpm) });
  const bpmVal = el('span', { id: 'bpmv' }, String(drill.bpm));
  tempoGroup.append(el('label', { for: 'bpm' }, 'Tempo'), bpmRange, bpmVal);
  const barGroup = el('div', { class: 'group' });
  const barInput = el('input', { type: 'number', id: 'bar', min: '1', value: '1' });
  const loopBtn = el('button', { id: 'loopBtn' }, 'Loop');
  const guideBtn = el('button', { id: 'guideBtn' }, 'Guide sound');
  const clickBtn = el('button', { id: 'clickBtn' }, 'Metronome');
  loopBtn.classList.toggle('on', s.loop);
  guideBtn.classList.toggle('on', s.guide);
  clickBtn.classList.toggle('on', s.click);
  barGroup.append(el('label', { for: 'bar' }, 'Start bar'), barInput, loopBtn, guideBtn, clickBtn);
  const transport = el('div', { class: 'group' });
  const playBtn = el('button', { class: 'primary', id: 'playBtn' }, 'Start');
  const resetBtn = el('button', { id: 'resetBtn' }, 'Restart');
  transport.append(playBtn, resetBtn);
  toolbar.append(exGroup, el('div', { class: 'group' }, ''), modeSeg, handSeg, tempoGroup, barGroup, transport);
  root.appendChild(toolbar);
  const stage = createStage(root);
  const waitMsg = el('div', { class: 'cue', id: 'waitmsg' }, 'Play the highlighted keys');
  stage.root.appendChild(waitMsg);
  const renderer = new KeyboardRenderer(stage.ctx, keyboardThemeFromCss());
  const below = el('div', { class: 'below' });
  const lessonCard = el('div', { class: 'card', id: 'lesson' });
  const statsCard = el('div', { class: 'card' });
  statsCard.innerHTML = `<h2>This run</h2>
    <div class="stats" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat"><b id="sAcc">—</b><span>accuracy</span></div>
      <div class="stat"><b id="sWrong">0</b><span>wrong notes</span></div>
      <div class="stat"><b id="sMiss">0</b><span>missed (play along)</span></div>
      <div class="stat"><b id="sBest">—</b><span>best</span></div>
    </div>
    <div class="legend"><span><i style="background:var(--rh)"></i>right hand</span><span><i style="background:var(--lh)"></i>left hand</span><span><i style="background:var(--ok)"></i>correct</span><span><i style="background:var(--bad)"></i>wrong key</span></div>
    <p class="hint">Chrome or Edge with the keyboard on USB (or Bluetooth MIDI). Click on-screen keys to test without a keyboard. <kbd>Space</kbd> starts and pauses.</p>`;
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
    const bpm = Number(bpmRange.value) || drill!.bpm;
    run.setBpm(bpm, performance.now());
    playBtn.textContent = 'Start';
    waitMsg.style.display = 'none';
    stage.result.style.display = 'none';
    updateStats();
    draw();
  }

  function loadDrill(d: Drill): void {
    drill = d;
    bpmRange.value = String(d.bpm);
    bpmVal.textContent = String(d.bpm);
    barInput.value = '1';
    barInput.max = String(Math.ceil(Math.max(...d.targets.map((t) => (t.type === 'note' ? t.t + t.d : 0)), 4) / 4));
    stage.title.textContent = d.name;
    lessonCard.innerHTML = md(d.lesson || '## Loaded file\n\nHands were split by track (or at middle C if the file has one track). Right hand in amber, left in blue.');
    location.hash = `#/piano/${encodeURIComponent(d.id)}`;
    newRun();
  }

  function togglePlay(): void {
    if (!run) return;
    app.sounds.ensure();
    const now = performance.now();
    if (run.active) {
      run.pause(now);
      playBtn.textContent = 'Start';
      waitMsg.style.display = 'none';
      cancelAnimationFrame(raf);
      return;
    }
    if (run.phase === 'finished') newRun();
    if (run!.phase === 'idle' && run!.inputLog.length === 0) run!.start(now);
    else run!.resume(now);
    playBtn.textContent = 'Pause';
    stage.result.style.display = 'none';
    loop();
  }

  function loop(): void {
    cancelAnimationFrame(raf);
    if (!run || !run.active) return;
    const now = performance.now();
    const r = run.tick(now);
    if (app.settings.click) for (const b of r.beats) if (b >= 0) app.sounds.click(b % 4 === 0, 1400);
    if (app.settings.guide) for (const n of r.guide) app.sounds.tone(n.n, (n.d * 60) / run.bpm);
    waitMsg.style.display = r.waiting ? 'block' : 'none';
    updateStats();
    draw();
    if (r.ended) {
      playBtn.textContent = 'Start';
      waitMsg.style.display = 'none';
      void finishRun();
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  async function finishRun(): Promise<void> {
    if (!run || !drill) return;
    const attempt = run.attempt();
    const res = await app.addAttempt(attempt);
    const box = stage.result;
    box.innerHTML = '';
    box.appendChild(el('small', {}, drill.name));
    box.appendChild(el('b', {}, attempt.score == null ? '—' : `${attempt.score}%`));
    box.appendChild(el('div', { class: `medal ${attempt.medal ? 'medal-' + attempt.medal : ''}` }, attempt.medal ?? (attempt.passed ? 'passed' : 'keep going')));
    box.appendChild(el('small', {}, `${res.isPb ? 'New personal best · ' : ''}+${res.xp} XP`));
    const again = el('button', { class: 'small' }, 'Again');
    again.onclick = () => {
      newRun();
      togglePlay();
    };
    box.appendChild(again);
    box.style.display = 'block';
    updateStats();
  }

  function updateStats(): void {
    if (!run || !drill) return;
    const acc = run.accuracy();
    $('sAcc').textContent = acc == null ? '—' : `${acc}%`;
    $('sWrong').textContent = String(run.wrong);
    $('sMiss').textContent = String(run.missed);
    const best = app.best[drill.id];
    $('sBest').textContent = best == null ? '—' : `${best}%`;
    const pos = run.pos(performance.now());
    const bb = run.transport.barBeat(pos);
    stage.barinfo.textContent = `Bar ${bb.bar} of ${run.bars} · beat ${bb.beat}`;
    const next = run.nextDue(pos);
    stage.lastin.textContent = next.length ? 'Next: ' + next.map((n) => noteName(n.n)).join(' + ') : '';
  }

  function draw(): void {
    if (!run) return;
    const pos = run.pos(performance.now());
    renderer.draw({ states: run.states, pos, hand: run.hand, pressed: run.pressed, flashes: run.flashes, expected: run.expected(pos) });
    if (!run.active && Object.keys(run.flashes).length) requestAnimationFrame(draw);
  }

  // wiring
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
      const d: Drill = {
        id, version: 1, name: `File · ${f.name}`, tier: 'Custom', profile: 'piano88', bpm: parsed.bpm,
        bars: Math.ceil(Math.max(...parsed.notes.map((n) => n.t + n.d), 4) / 4), targets: parsed.notes, lesson: '',
      };
      await app.addDrill(d, 'imported');
      fill();
      loadDrill(d);
    } catch (err) {
      alert('Could not read that MIDI file: ' + (err as Error).message);
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
        if (key !== 'loop') app.sounds.ensure();
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
        run.noteOn(ev.note, ev.timeStamp);
        updateStats();
        if (!run.active) draw();
      } else if (ev.kind === 'noteoff') {
        run.noteOff(ev.note, ev.timeStamp);
        if (!run.active) draw();
      }
    }),
  );
  let mouseNote: number | null = null;
  stage.canvas.addEventListener('pointerdown', (e) => {
    app.sounds.ensure();
    const r = stage.canvas.getBoundingClientRect();
    const n = noteAt(e.clientX - r.left, e.clientY - r.top, renderer.metrics);
    if (n != null && run) {
      mouseNote = n;
      run.noteOn(n, performance.now());
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
    const { w, h } = stage.fit(0.42);
    renderer.resize(w, h);
    draw();
  };
  window.addEventListener('resize', resize);
  const onTheme = () => {
    renderer.setTheme(keyboardThemeFromCss());
    draw();
  };
  offs.push(app.on('settings', onTheme));
  const browse = el('p', { class: 'hint' });
  const link = el('a', { href: '#/browse?profile=piano88' }, 'All piano exercises');
  browse.appendChild(link);
  lessonCard.after(browse);
  void navigate;

  loadDrill(drill);
  resize();
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
