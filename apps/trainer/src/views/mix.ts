import { Mixer, Crowd, camelot, sessionScore, STEM_NAMES, type Genre, type StemName, type InputEvent, type Deck } from '@midi-trainer/engine';
import type { ControlEvent } from '../app';
import type { View } from '../router';
import { el } from '../ui/dom';
import { createController } from '../ui/controller';
import { icon } from '../ui/icons';

type Mode = 'free' | 'beatmatch' | 'song';

let mixer: Mixer | null = null;
export function getMixer(): Mixer | null {
  return mixer;
}

/**
 * Decks: two synthesized tracks through an FLX4-shaped mixer. Three modes: free mix
 * (session score against the phrase grid), beatmatch by ear (hidden tempo offset, strobe
 * dots, reveal), and song mode (crowd meter and requests, Fuser pattern).
 */
export const mixView: View = (root, app, params) => {
  const offs: Array<() => void> = [];
  let raf = 0;
  let mode: Mode = (params.query.get('mode') as Mode) || 'free';
  const genres: Genre[] = ['house', 'tech-house', 'techno', 'trance', 'drum-and-bass', 'dubstep', 'hip-hop'];
  const log: InputEvent[] = [];
  let sessionStart: number | null = null;
  let crowd: Crowd | null = null;
  let hiddenOffset = 0;
  let revealed = false;
  let lockStart: number | null = null;
  let lockSamples: number[] = [];
  let ctlOff: (() => void) | null = null;

  const head = el('div', { class: 'rail' });
  const modeSeg = el('div', { class: 'seg' });
  for (const [v, t] of [['free', 'Free mix'], ['beatmatch', 'Beatmatch by ear'], ['song', 'Song mode']] as const) {
    const b = el('button', { 'data-v': v }, t);
    b.classList.toggle('on', mode === v);
    b.onclick = () => {
      mode = v;
      modeSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      setupMode();
    };
    modeSeg.appendChild(b);
  }
  const startBtn = el('button', { class: 'primary', id: 'mixStart' }, 'Start audio');
  const focusBtn = el('button', { id: 'focusBtn' }, 'Beat focus');
  const ctlBtn = el('button', { id: 'mixCtl' }, 'On-screen controller');
  head.append(modeSeg, startBtn, focusBtn, ctlBtn);
  root.appendChild(head);
  const intro = el('p', { class: 'hint' }, 'All audio here is synthesized on the fly (no licensed music). Load a track into each deck, then mix with your controller or the on-screen one. Faders, EQ, CFX, echo, loops, hot cues, sync, jog nudge, brake and backspin are wired to the FLX4 controls.');
  root.appendChild(intro);
  const modePanel = el('div', { class: 'panel', style: 'margin-bottom:14px' });
  root.appendChild(modePanel);
  const consoleEl = el('div', { class: 'console' });
  root.appendChild(consoleEl);
  const decks = consoleEl;
  const mixerCard = el('div', { class: 'panel mixerstrip' });
  const ctlHost = el('div');
  root.appendChild(ctlHost);

  const deckUi: Record<'A' | 'B', { card: HTMLElement; info: HTMLElement; meter: HTMLElement; stems: Record<StemName, HTMLButtonElement>; grid: HTMLElement; head: HTMLElement; platter: HTMLElement; vu: HTMLElement; chips: { play: HTMLElement; section: HTMLElement; loop: HTMLElement } }> = {} as never;
  for (const name of ['A', 'B'] as const) {
    const card = el('div', { class: 'panel deckcard', 'data-deck': name, style: `--accent: var(${name === 'A' ? '--deck-a' : '--deck-b'})` });
    const headRow = el('div', { class: 'head' });
    headRow.appendChild(el('h2', {}, `Deck ${name}`));
    const chips = { play: el('span', { class: 'chip' }, 'stopped'), section: el('span', { class: 'chip' }, '—'), loop: el('span', { class: 'chip' }, 'no loop') };
    const chipRow = el('span', { class: 'row', style: 'gap:4px' });
    chipRow.append(chips.play, chips.section, chips.loop);
    headRow.appendChild(chipRow);
    const info = el('div', { class: 'track' }, 'Nothing loaded.');
    const grid = el('div', { class: 'beatgrid' });
    const platterRow = el('div', { class: 'platterrow' });
    const platter = el('div', { class: 'platter' });
    platter.appendChild(el('i'));
    const right = el('div', { style: 'display:flex;flex-direction:column;gap:8px' });
    const loadRow = el('div', { class: 'row' });
    const genreSel = el('select');
    for (const g of genres) genreSel.appendChild(el('option', { value: g }, g));
    genreSel.value = genres.includes(app.settings.genre as Genre) ? app.settings.genre : 'house';
    const seed = el('input', { type: 'number', value: String(name === 'A' ? 7 : 21), style: 'width:64px', 'aria-label': 'Seed' });
    const load = el('button', { id: `load${name}`, class: 'small' }, 'Load');
    load.onclick = () => void loadDeck(name, Number(seed.value) || 1, genreSel.value as Genre);
    const play = el('button', { id: `play${name}`, class: 'primary small' });
    play.appendChild(icon('play', 14));
    play.onclick = () => mixer?.deck(name).toggle();
    loadRow.append(genreSel, seed, load, play);
    const cueRow = el('div', { class: 'row' });
    for (let i = 0; i < 4; i++) {
      const b = el('button', { class: 'small pad' }, `${i + 1}`);
      b.title = `Hot cue ${i + 1}`;
      b.onclick = () => {
        mixer?.deck(name).cue(i);
        crowd?.event({ kind: 'cue', deck: name, beat: beatA() });
      };
      cueRow.appendChild(b);
    }
    const loopBtn = el('button', { class: 'small' }, 'Loop 4');
    loopBtn.onclick = () => mixer?.deck(name).toggleLoop(4);
    const halfBtn = el('button', { class: 'small' }, '½');
    halfBtn.onclick = () => mixer?.deck(name).halveLoop();
    const syncBtn = el('button', { class: 'small' }, 'Sync');
    syncBtn.onclick = () => mixer?.sync(name);
    const brake = el('button', { class: 'small' }, 'Brake');
    brake.onclick = () => mixer?.deck(name).brake();
    const spin = el('button', { class: 'small' }, 'Backspin');
    spin.onclick = () => mixer?.deck(name).backspin();
    cueRow.append(loopBtn, halfBtn, syncBtn, brake, spin);
    const stemsRow = el('div', { class: 'row' });
    const stems = {} as Record<StemName, HTMLButtonElement>;
    for (const s of STEM_NAMES) {
      if (s === 'riser') continue;
      const b = el('button', { class: 'small on' }, s);
      b.onclick = () => {
        const d = mixer?.deck(name);
        if (!d) return;
        const mute = !d.stemMute[s];
        d.setStemMute(s, mute);
        b.classList.toggle('on', !mute);
        crowd?.event({ kind: 'stem', deck: name, stem: s, on: !mute, beat: beatA() });
        logEvent(`stem${name}:${s}`, mute ? 0 : 1);
      };
      stems[s] = b;
      stemsRow.appendChild(b);
    }
    const tempoRow = el('div', { class: 'row' });
    const tempo = el('input', { type: 'range', min: '0', max: '1000', value: '500', id: `tempo${name}`, style: 'flex:1', 'aria-label': 'Tempo' });
    tempo.oninput = () => onControl({ kind: 'cc', c: `tempo${name}`, value: Number(tempo.value) / 1000, timeStamp: performance.now() });
    tempoRow.append(el('span', { class: 'label' }, 'Tempo ±8%'), tempo);
    right.append(loadRow, cueRow, stemsRow, tempoRow);
    platterRow.append(platter, right);
    const vu = el('div', { class: 'vu' });
    for (let i = 0; i < 12; i++) vu.appendChild(el('i'));
    const meter = el('div', { class: 'meter' });
    meter.appendChild(el('i', { style: 'width:0%' }));
    card.append(headRow, info, grid, platterRow, vu, meter);
    decks.appendChild(card);
    deckUi[name] = { card, info, meter, stems, grid, head: grid, platter, vu, chips };
  }
  /** Beat grid: one bar per column, height and colour from the section's stem gains. */
  function drawGrid(name: 'A' | 'B'): void {
    const d = mixer?.deck(name);
    const ui = deckUi[name];
    ui.grid.innerHTML = '';
    if (!d?.spec) return;
    for (let bar = 0; bar < d.spec.bars; bar++) {
      const sec = d.spec.sections.find((s) => bar >= s.start && bar < s.start + s.bars);
      const i = el('i', { class: sec ? (sec.stems.bass > 0.5 && sec.stems.kick > 0.5 ? 'low' : sec.stems.kick > 0.5 ? 'mid' : 'hi') : '' });
      const h = sec ? 20 + Math.round(70 * ((sec.stems.kick + sec.stems.bass + sec.stems.hat + sec.stems.pad) / 4)) : 15;
      i.style.height = `${h}%`;
      ui.grid.appendChild(i);
    }
    for (const sec of d.spec.sections) ui.grid.appendChild(el('span', { class: 'sec', style: `left:${((100 * sec.start) / d.spec.bars).toFixed(1)}%` }, sec.kind));
    const head = el('div', { class: 'playhead', style: 'left:0' });
    ui.grid.appendChild(head);
    ui.head = head;
  }
  mixerCard.appendChild(el('div', { class: 'label' }, 'Mixer'));
  const knobs = el('div', { class: 'knobs' });
  const slots = el('div', { class: 'slots' });
  const xfWrap = el('div', { class: 'xf' });
  const mkRange = (id: string, v: number, fn: (x: number) => void, extra: Record<string, string> = {}) => {
    const i = el('input', { type: 'range', min: '0', max: '1000', value: String(Math.round(v * 1000)), id: `mix-${id}`, 'aria-label': id, ...extra });
    i.oninput = () => fn(Number(i.value) / 1000);
    return i;
  };
  const cc = (id: string) => (v: number) => onControl({ kind: 'cc', c: id, value: v, timeStamp: performance.now() });
  for (const k of ['trim', 'hi', 'mid', 'low', 'filt'] as const) {
    for (const name of ['A', 'B'] as const) {
      const w = el('label', { class: 'knob' }, `${k === 'filt' ? 'CFX' : k} ${name}`);
      w.appendChild(mkRange(`${k}${name}`, 0.5, cc(`${k}${name}`)));
      knobs.appendChild(w);
    }
  }
  for (const name of ['A', 'B'] as const) {
    const w = el('label', { class: 'slot' }, `Ch ${name}`);
    w.appendChild(mkRange(`fader${name}`, name === 'A' ? 1 : 0, cc(`fader${name}`)));
    slots.appendChild(w);
  }
  xfWrap.appendChild(document.createTextNode('Crossfader'));
  xfWrap.appendChild(mkRange('xf', 0.5, cc('xf')));
  const echoWrap = el('label', { class: 'knob' }, 'Echo level');
  echoWrap.appendChild(mkRange('fxLevel', 0.5, cc('fxLevel')));
  mixerCard.append(knobs, slots, xfWrap, echoWrap);
  const fxRow = el('div', { class: 'row', style: 'justify-content:center' });
  const echoBtn = el('button', { id: 'echoBtn', class: 'small' }, 'Echo');
  echoBtn.onclick = () => onControl({ kind: 'tap', c: 'beatFxOn', timeStamp: performance.now() });
  const chSeg = el('div', { class: 'seg' });
  for (const [c, t] of [['chSelect1', '1'], ['chSelect2', '2'], ['chSelectMaster', 'M']] as const) {
    const b = el('button', { title: c }, t);
    b.classList.toggle('on', c === 'chSelect1');
    b.onclick = () => onControl({ kind: 'tap', c, timeStamp: performance.now() });
    chSeg.appendChild(b);
  }
  fxRow.append(echoBtn, chSeg);
  mixerCard.appendChild(fxRow);
  const masterWrap = el('div', {});
  masterWrap.appendChild(el('div', { class: 'label', style: 'text-align:center' }, 'Master'));
  const masterVu = el('div', { class: 'vu' });
  for (let i = 0; i < 12; i++) masterVu.appendChild(el('i'));
  masterWrap.appendChild(masterVu);
  mixerCard.appendChild(masterWrap);
  // the console order is deck A · mixer · deck B
  consoleEl.insertBefore(mixerCard, deckUi.B.card);
  function lightVu(vu: HTMLElement, level: number): void {
    const n = Math.round(level * 12);
    vu.querySelectorAll('i').forEach((seg, i) => {
      seg.className = i < n ? `on${i >= 10 ? ' hot' : i >= 7 ? ' mid' : ''}` : '';
    });
  }
  // ---------- helpers ----------
  const beatA = () => mixer?.a.beatAt() ?? 0;
  function logEvent(c: string, v: number): void {
    if (sessionStart == null) return;
    log.push({ t: beatA(), c, v });
  }
  let echoOn = false;
  async function ensureMixer(): Promise<Mixer> {
    if (!mixer) mixer = new Mixer();
    await mixer.ensure();
    return mixer;
  }
  async function loadDeck(name: 'A' | 'B', seed: number, genre: Genre): Promise<void> {
    const m = await ensureMixer();
    deckUi[name].info.textContent = 'Rendering…';
    const bpmOverride = name === 'B' && mode === 'beatmatch' && m.a.spec ? Math.round(m.a.spec.bpm * (1 + hiddenOffset)) : undefined;
    const spec = await m.loadTrack(name, seed, genre, bpmOverride);
    deckUi[name].info.textContent = `${spec.name} · ${spec.genre} · ${mode === 'beatmatch' && name === 'B' && !revealed ? '??' : spec.bpm} BPM · ${camelot(spec.root, spec.minor)}`;
    deckUi[name].grid.innerHTML = '';
    drawGrid(name);
    if (name === 'A') m.setEchoLevel(0.5);
  }
  function setupMode(): void {
    modePanel.innerHTML = '';
    log.length = 0;
    sessionStart = null;
    crowd = null;
    revealed = false;
    lockStart = null;
    lockSamples = [];
    if (mode === 'free') {
      modePanel.innerHTML = '<h2>Free mix · session mode</h2><p class="hint">Mix as you like. Every large fader, EQ or filter move and every transport press is judged by how close it lands to an 8-bar phrase boundary on deck A. End the session for the score.</p>';
      const b = el('button', { class: 'primary', id: 'sessionBtn' }, 'Start session');
      b.onclick = () => {
        if (sessionStart == null) {
          sessionStart = beatA();
          log.length = 0;
          b.textContent = 'End session';
        } else {
          const r = sessionScore(log.map((e) => ({ ...e, t: e.t - sessionStart! })), 32, 1);
          sessionStart = null;
          b.textContent = 'Start session';
          const out = el('div');
          out.innerHTML = `<p><b style="font-size:26px">${r.score ?? '—'}%</b> of ${r.moves.length} moves on the phrase grid · mean offset ${r.meanOff == null ? '—' : r.meanOff.toFixed(2)} beats</p>`;
          const t = el('table');
          t.innerHTML = '<thead><tr><th>Beat</th><th>Control</th><th>Offset</th></tr></thead>';
          const tb = el('tbody');
          for (const m of r.moves.slice(0, 40)) {
            const tr = el('tr');
            tr.innerHTML = `<td>${m.t.toFixed(1)}</td><td>${app.controlName(m.c)}</td><td style="color:${m.onGrid ? 'var(--perfect)' : 'var(--miss)'}">${m.offBeats > 0 ? '+' : ''}${m.offBeats.toFixed(2)}</td>`;
            tb.appendChild(tr);
          }
          t.appendChild(tb);
          out.appendChild(t);
          modePanel.appendChild(out);
        }
      };
      modePanel.appendChild(b);
    } else if (mode === 'beatmatch') {
      hiddenOffset = (Math.random() * 2 - 1) * 0.06;
      modePanel.innerHTML = '<h2>Beatmatch by ear</h2><p class="hint">Deck B is loaded a hidden few percent off deck A. Match it with B\'s tempo fader and nudges, using the kicks (Beat focus helps). The strobe dots drift at your phase error; when they freeze you are locked. Hold the lock for 8 bars, then reveal.</p>';
      const strobe = el('div', { class: 'strobe', id: 'strobe' });
      for (let i = 0; i < 8; i++) strobe.appendChild(el('i'));
      modePanel.appendChild(strobe);
      const status = el('p', { id: 'bmStatus' }, 'Load both decks and play them.');
      modePanel.appendChild(status);
      const lock = el('button', { class: 'primary', id: 'lockBtn' }, 'Start 8-bar lock check');
      lock.onclick = () => {
        lockStart = beatA();
        lockSamples = [];
        status.textContent = 'Checking…';
      };
      const reveal = el('button', {}, 'Reveal');
      reveal.onclick = () => {
        revealed = true;
        const m = mixer;
        if (!m?.a.spec || !m.b.spec) return;
        const err = ((m.b.bpm - m.a.bpm) / m.a.bpm) * 100;
        deckUi.B.info.textContent = `${m.b.spec.name} · ${m.b.spec.bpm} BPM native · now ${m.b.bpm} · error ${err.toFixed(2)}%`;
      };
      modePanel.append(lock, document.createTextNode(' '), reveal);
      if (mixer?.a.spec) void loadDeck('B', 21 + Math.floor(Math.random() * 50), mixer.a.spec.genre);
    } else {
      crowd = new Crowd();
      modePanel.innerHTML = '<h2>Song mode</h2><p class="hint">Keep the crowd up. Changes that land on a downbeat score; on a phrase boundary they score more; off-grid moves cost you. Requests appear with a deadline. Deck A\'s beat is the grid.</p>';
      const bar = el('div', { class: 'crowd' });
      bar.appendChild(el('i', { id: 'crowdBar', style: 'width:50%' }));
      modePanel.appendChild(bar);
      const req = el('p', { id: 'requests', class: 'hint' }, 'No requests yet.');
      modePanel.appendChild(req);
      const end = el('button', { class: 'primary' }, 'End set');
      end.onclick = () => {
        const r = crowd!.result();
        modePanel.appendChild(el('p', {}, `Set: average crowd ${r.average}% · ${'★'.repeat(r.stars)} · ${r.onGrid} of ${r.moves} moves on grid · ${r.fulfilled} requests met`));
      };
      modePanel.appendChild(end);
    }
  }

  // ---------- control routing ----------
  const lastValue: Record<string, number> = {};
  function onControl(ev: ControlEvent): void {
    const m = mixer;
    if (!m) return;
    if (ev.kind === 'noteon' || ev.kind === 'noteoff' || ev.kind === 'release') return;
    const c = ev.c;
    const deckOf = (id: string): Deck | null => (id.endsWith('A') ? m.a : id.endsWith('B') ? m.b : null);
    if (ev.kind === 'cc') {
      const v = ev.value;
      const d = deckOf(c);
      const base = c.replace(/[AB]$/, '');
      if (d) {
        if (base === 'trim') d.setTrim(v);
        else if (base === 'hi') d.setEq('high', v);
        else if (base === 'mid') d.setEq('mid', v);
        else if (base === 'low') d.setEq('low', v);
        else if (base === 'filt') d.setFilter(v);
        else if (base === 'fader') d.setFader(v);
        else if (base === 'tempo') d.setTempoFader(v);
      } else if (c === 'xf') m.setCrossfader(v);
      else if (c === 'master') m.setMaster(v);
      else if (c === 'fxLevel') m.setEchoLevel(v);
      const input = document.querySelector<HTMLInputElement>(`#mix-${c}`) ?? document.querySelector<HTMLInputElement>(`#${c}`);
      if (input && document.activeElement !== input) input.value = String(Math.round(v * 1000));
      const prev = lastValue[c];
      if (prev == null || Math.abs(v - prev) >= 0.25) {
        lastValue[c] = v;
        if (['fader', 'low', 'filt'].includes(base) || c === 'xf') crowd?.event({ kind: 'transition', beat: beatA() });
      }
      logEvent(c, v);
      return;
    }
    if (ev.kind === 'rel') {
      deckOf(c)?.jog(ev.delta);
      return;
    }
    // taps
    logEvent(c, 1);
    const d = deckOf(c);
    const base = c.replace(/[AB]\d*$/, '');
    if (d) {
      if (base === 'play') {
        d.toggle();
        crowd?.event({ kind: 'transition', beat: beatA() });
      } else if (base === 'cue') d.seek(0);
      else if (base === 'sync') m.sync(c.endsWith('A') ? 'A' : 'B');
      else if (base === 'hc') d.cue(Number(c.slice(-1)) - 1);
      else if (base === 'loop') d.toggleLoop(4);
      else if (base === 'loopOut') {
        if (d.state().loop) d.toggleLoop();
      } else if (base === 'reloop') d.halveLoop();
      else if (base === 'padFx') {
        const n = Number(c.slice(-1));
        if (n === 5) d.backspin();
        else if (n === 6) d.brake();
        else if (n === 4) d.halveLoop();
        crowd?.event({ kind: 'fx', beat: beatA() });
      } else if (base === 'beatLoop') {
        const n = Number(c.slice(-1));
        d.toggleLoop([0.25, 0.5, 1, 2, 4, 8, 16, 32][n - 1] ?? 4);
      }
      return;
    }
    if (c === 'beatFxOn') {
      echoOn = !echoOn;
      m.setEcho(echoOn);
      echoBtn.classList.toggle('on', echoOn);
      crowd?.event({ kind: 'fx', beat: beatA() });
    } else if (c === 'chSelect1' || c === 'chSelect2' || c === 'chSelectMaster') {
      m.setChSelect(c === 'chSelect1' ? 1 : c === 'chSelect2' ? 2 : 'master');
      chSeg.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', ['chSelect1', 'chSelect2', 'chSelectMaster'][i] === c));
    } else if (c === 'smartCfx') {
      // one-knob combo: filter and echo together on deck A
      echoOn = true;
      m.setEcho(true);
    }
  }
  offs.push(app.on('control', onControl));

  startBtn.onclick = async () => {
    await ensureMixer();
    startBtn.textContent = 'Audio running';
    const g: Genre = genres.includes(app.settings.genre as Genre) ? (app.settings.genre as Genre) : 'house';
    if (!mixer!.a.loaded) await loadDeck('A', 7, g);
    if (!mixer!.b.loaded) await loadDeck('B', 21, g);
    mixer!.a.setFader(1);
  };
  let focus = false;
  focusBtn.onclick = () => {
    focus = !focus;
    focusBtn.classList.toggle('on', focus);
    mixer?.setBeatFocus(focus);
  };
  ctlBtn.onclick = () => {
    if (ctlOff) {
      ctlOff();
      ctlOff = null;
      ctlBtn.classList.remove('on');
    } else {
      ctlOff = createController(app, ctlHost, { compact: true });
      ctlBtn.classList.add('on');
    }
  };

  // ---------- frame ----------
  let lastBeat = 0;
  let requestTimer = 0;
  const frame = () => {
    const m = mixer;
    if (m) {
      m.tick();
      for (const name of ['A', 'B'] as const) {
        const d = m.deck(name);
        const st = d.state();
        if (d.spec) {
          const ui = deckUi[name];
          const bb = { bar: Math.floor(st.beat / 4) + 1, beat: (Math.floor(st.beat) % 4) + 1 };
          const hidden = mode === 'beatmatch' && name === 'B' && !revealed;
          ui.info.textContent = `${d.spec.name} · ${d.spec.genre} · ${hidden ? '??' : st.bpm.toFixed(1)} BPM · ${camelot(d.spec.root, d.spec.minor)} · bar ${bb.bar}.${bb.beat}`;
          ui.chips.play.textContent = st.playing ? 'playing' : 'paused';
          ui.chips.play.classList.toggle('on', st.playing);
          ui.chips.section.textContent = st.section ?? '—';
          ui.chips.loop.textContent = st.loop ? `loop ${st.loop.beats}` : 'no loop';
          ui.chips.loop.classList.toggle('on', !!st.loop);
          const frac = st.beat / (d.spec.bars * 4);
          (ui.meter.firstElementChild as HTMLElement).style.width = `${Math.round(100 * frac)}%`;
          if (!ui.grid.childElementCount) drawGrid(name);
          ui.head.style.left = `${(100 * frac).toFixed(2)}%`;
          (ui.platter.firstElementChild as HTMLElement).style.transform = `rotate(${((st.beat % 4) * 90).toFixed(1)}deg)`;
          ui.platter.style.boxShadow = st.playing && (st.beat % 1) < 0.15 ? `var(--inset), 0 0 18px color-mix(in oklch, var(--accent) 40%, transparent)` : 'var(--inset)';
          lightVu(ui.vu, st.playing ? Math.min(1, m.level() * d.fader.gain.value * 1.4 + ((st.beat % 1) < 0.1 ? 0.15 : 0)) : 0);
        }
      }
      lightVu(masterVu, m.level());
      const beat = beatA();
      if (mode === 'beatmatch' && m.a.spec && m.b.spec) {
        const phase = m.b.phaseTo(m.a);
        const dots = document.querySelectorAll<HTMLElement>('#strobe i');
        dots.forEach((dot, i) => {
          dot.style.transform = `translateX(${Math.round(phase * 40 * (i % 2 ? 1 : -1))}px)`;
          dot.style.background = Math.abs(phase) < 0.04 ? 'var(--perfect)' : 'var(--deck-a)';
          dot.style.boxShadow = Math.abs(phase) < 0.04 ? '0 0 8px var(--perfect)' : 'none';
        });
        if (lockStart != null) {
          lockSamples.push(Math.abs(phase));
          if (beat - lockStart >= 32) {
            const mean = lockSamples.reduce((a, b) => a + b, 0) / lockSamples.length;
            const ms = (mean * 60000) / m.a.bpm;
            const status = document.querySelector('#bmStatus');
            if (status) status.textContent = `Lock over 8 bars: mean phase error ${Math.round(ms)} ms ${ms < 20 ? '· locked (under the 20 ms flam threshold)' : '· not yet'}`;
            lockStart = null;
          }
        }
      }
      if (mode === 'song' && crowd && m.a.state().playing) {
        crowd.tick(beat, Math.max(0, beat - lastBeat));
        (document.querySelector('#crowdBar') as HTMLElement | null)?.style.setProperty('width', `${Math.round(crowd.meter * 100)}%`);
        if (beat - requestTimer > 64 && crowd.open.length === 0) {
          requestTimer = beat;
          const asks: Array<[string, (ev: Parameters<Crowd['event']>[0]) => boolean]> = [
            ['Bring the bass in on B', (ev) => ev.kind === 'stem' && ev.deck === 'B' && ev.stem === 'bass' && ev.on],
            ['Kill the kick on A', (ev) => ev.kind === 'stem' && ev.deck === 'A' && ev.stem === 'kick' && !ev.on],
            ['Hit an effect', (ev) => ev.kind === 'fx'],
            ['Jump to a cue', (ev) => ev.kind === 'cue'],
          ];
          const pick = asks[Math.floor(Math.random() * asks.length)]!;
          crowd.request(pick[0], beat, 8, pick[1]);
        }
        const req = document.querySelector('#requests');
        if (req) req.textContent = crowd.open.length ? crowd.open.map((r) => `${r.text} · ${Math.max(0, Math.ceil((r.deadline - beat) / 4))} bars left`).join(' · ') : 'No open requests.';
      }
      lastBeat = beat;
    }
    raf = requestAnimationFrame(frame);
  };
  setupMode();
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    offs.forEach((f) => f());
    ctlOff?.();
  };
};
