import { Mixer, Crowd, camelot, sessionScore, STEM_NAMES, type Genre, type StemName, type InputEvent, type Deck } from '@midi-trainer/engine';
import type { ControlEvent } from '../app';
import type { View } from '../router';
import { el } from '../ui/dom';
import { createController } from '../ui/controller';

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

  const head = el('div', { class: 'toolbar' });
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
  const modePanel = el('div', { class: 'card', style: 'margin-bottom:14px' });
  root.appendChild(modePanel);
  const decks = el('div', { class: 'decks' });
  root.appendChild(decks);
  const mixerCard = el('div', { class: 'card', style: 'margin-top:14px' });
  root.appendChild(mixerCard);
  const ctlHost = el('div');
  root.appendChild(ctlHost);

  const deckUi: Record<'A' | 'B', { card: HTMLElement; info: HTMLElement; meter: HTMLElement; stems: Record<StemName, HTMLButtonElement> }> = {} as never;
  for (const name of ['A', 'B'] as const) {
    const card = el('div', { class: 'card deckcard', 'data-deck': name });
    card.appendChild(el('h2', {}, `Deck ${name}`));
    const loadRow = el('div', { class: 'row' });
    const genreSel = el('select');
    for (const g of genres) genreSel.appendChild(el('option', { value: g }, g));
    genreSel.value = (app.settings.genre as Genre) in genres ? app.settings.genre : 'house';
    const seed = el('input', { type: 'number', value: String(name === 'A' ? 7 : 21), style: 'width:70px' });
    const load = el('button', { id: `load${name}` }, 'Load track');
    load.onclick = () => void loadDeck(name, Number(seed.value) || 1, genreSel.value as Genre);
    const play = el('button', { id: `play${name}` }, 'Play/Pause');
    play.onclick = () => mixer?.deck(name).toggle();
    const cueRow = el('div', { class: 'row' });
    for (let i = 0; i < 4; i++) {
      const b = el('button', { class: 'small' }, `Cue ${i + 1}`);
      b.onclick = () => {
        mixer?.deck(name).cue(i);
        crowd?.event({ kind: 'cue', deck: name, beat: beatA() });
      };
      cueRow.appendChild(b);
    }
    const loopBtn = el('button', { class: 'small' }, 'Loop 4');
    loopBtn.onclick = () => mixer?.deck(name).toggleLoop(4);
    const halfBtn = el('button', { class: 'small' }, 'Halve');
    halfBtn.onclick = () => mixer?.deck(name).halveLoop();
    const syncBtn = el('button', { class: 'small' }, 'Sync');
    syncBtn.onclick = () => mixer?.sync(name);
    const brake = el('button', { class: 'small' }, 'Brake');
    brake.onclick = () => mixer?.deck(name).brake();
    const spin = el('button', { class: 'small' }, 'Backspin');
    spin.onclick = () => mixer?.deck(name).backspin();
    cueRow.append(loopBtn, halfBtn, syncBtn, brake, spin);
    loadRow.append(genreSel, seed, load, play);
    const info = el('p', { class: 'hint' }, 'Nothing loaded.');
    const meter = el('div', { class: 'meter' });
    meter.appendChild(el('i', { style: 'width:0%' }));
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
    const tempo = el('input', { type: 'range', min: '0', max: '1000', value: '500', id: `tempo${name}`, style: 'width:200px' });
    tempo.oninput = () => onControl({ kind: 'cc', c: `tempo${name}`, value: Number(tempo.value) / 1000, timeStamp: performance.now() });
    tempoRow.append(el('label', {}, 'Tempo ±8%'), tempo);
    card.append(loadRow, info, meter, cueRow, stemsRow, tempoRow);
    decks.appendChild(card);
    deckUi[name] = { card, info, meter, stems };
  }
  const strip = el('div', { class: 'row' });
  mixerCard.appendChild(el('h2', {}, 'Mixer'));
  const slider = (id: string, label: string, v: number, fn: (x: number) => void) => {
    const l = el('label', { style: 'display:flex;flex-direction:column;font-size:12px;color:var(--muted)' }, label);
    const i = el('input', { type: 'range', min: '0', max: '1000', value: String(Math.round(v * 1000)), id: `mix-${id}` });
    i.oninput = () => fn(Number(i.value) / 1000);
    l.appendChild(i);
    strip.appendChild(l);
    return i;
  };
  for (const name of ['A', 'B'] as const) {
    slider(`trim${name}`, `Trim ${name}`, 0.5, (v) => onControl({ kind: 'cc', c: `trim${name}`, value: v, timeStamp: performance.now() }));
    slider(`hi${name}`, `Hi ${name}`, 0.5, (v) => onControl({ kind: 'cc', c: `hi${name}`, value: v, timeStamp: performance.now() }));
    slider(`mid${name}`, `Mid ${name}`, 0.5, (v) => onControl({ kind: 'cc', c: `mid${name}`, value: v, timeStamp: performance.now() }));
    slider(`low${name}`, `Low ${name}`, 0.5, (v) => onControl({ kind: 'cc', c: `low${name}`, value: v, timeStamp: performance.now() }));
    slider(`filt${name}`, `CFX ${name}`, 0.5, (v) => onControl({ kind: 'cc', c: `filt${name}`, value: v, timeStamp: performance.now() }));
    slider(`fader${name}`, `Fader ${name}`, name === 'A' ? 1 : 0, (v) => onControl({ kind: 'cc', c: `fader${name}`, value: v, timeStamp: performance.now() }));
  }
  slider('xf', 'Crossfader', 0.5, (v) => onControl({ kind: 'cc', c: 'xf', value: v, timeStamp: performance.now() }));
  slider('fxLevel', 'Echo level', 0.5, (v) => onControl({ kind: 'cc', c: 'fxLevel', value: v, timeStamp: performance.now() }));
  mixerCard.appendChild(strip);
  const fxRow = el('div', { class: 'row' });
  const echoBtn = el('button', { id: 'echoBtn' }, 'Beat FX (echo) off');
  echoBtn.onclick = () => onControl({ kind: 'tap', c: 'beatFxOn', timeStamp: performance.now() });
  const chSeg = el('div', { class: 'seg' });
  for (const [c, t] of [['chSelect1', 'CH 1'], ['chSelect2', 'CH 2'], ['chSelectMaster', 'Master']] as const) {
    const b = el('button', {}, t);
    b.classList.toggle('on', c === 'chSelect1');
    b.onclick = () => onControl({ kind: 'tap', c, timeStamp: performance.now() });
    chSeg.appendChild(b);
  }
  const masterMeter = el('div', { class: 'meter', style: 'width:200px' });
  masterMeter.appendChild(el('i', { style: 'width:0%' }));
  fxRow.append(echoBtn, chSeg, el('label', {}, 'Master'), masterMeter);
  mixerCard.appendChild(fxRow);

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
            tr.innerHTML = `<td>${m.t.toFixed(1)}</td><td>${app.controlName(m.c)}</td><td style="color:${m.onGrid ? 'var(--ok)' : 'var(--bad)'}">${m.offBeats > 0 ? '+' : ''}${m.offBeats.toFixed(2)}</td>`;
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
      echoBtn.textContent = `Beat FX (echo) ${echoOn ? 'on' : 'off'}`;
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
    if (!mixer!.a.loaded) await loadDeck('A', 7, (app.settings.genre as Genre) || 'house');
    if (!mixer!.b.loaded) await loadDeck('B', 21, (app.settings.genre as Genre) || 'house');
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
          const bb = { bar: Math.floor(st.beat / 4) + 1, beat: (Math.floor(st.beat) % 4) + 1 };
          const hidden = mode === 'beatmatch' && name === 'B' && !revealed;
          deckUi[name].info.textContent = `${d.spec.name} · ${d.spec.genre} · ${hidden ? '??' : st.bpm.toFixed(1)} BPM · ${camelot(d.spec.root, d.spec.minor)} · ${st.playing ? 'playing' : 'paused'} · bar ${bb.bar}.${bb.beat} · ${st.section ?? ''}${st.loop ? ` · loop ${st.loop.beats}` : ''}`;
          (deckUi[name].meter.firstElementChild as HTMLElement).style.width = `${Math.round((100 * st.beat) / (d.spec.bars * 4))}%`;
        }
      }
      (masterMeter.firstElementChild as HTMLElement).style.width = `${Math.round(m.level() * 100)}%`;
      const beat = beatA();
      if (mode === 'beatmatch' && m.a.spec && m.b.spec) {
        const phase = m.b.phaseTo(m.a);
        const dots = document.querySelectorAll<HTMLElement>('#strobe i');
        dots.forEach((dot, i) => {
          dot.style.transform = `translateX(${Math.round(phase * 40 * (i % 2 ? 1 : -1))}px)`;
          dot.style.background = Math.abs(phase) < 0.04 ? 'var(--ok)' : 'var(--tap)';
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
