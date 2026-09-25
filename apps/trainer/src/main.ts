import {
  DrillRun, LaneRenderer, MidiAccess, TapTempo, Sounds, TrainerDb, FLX4_PROFILE, GENERIC_PROFILE,
  controlById, defaultValues, mappedControls, reverseMap, resolveThresholds, availability, themeFromCss,
  medalFor, parseDrillFile, formatDrillError, readLegacy, lengthBeats, DEFAULT_THRESHOLDS,
  type ControlMap, type Drill, type MidiEvent, type Profile, type Settings, type RunStats,
} from '@midi-trainer/engine';
import { marked } from 'marked';
import { builtinDrills, tierRank } from './content';
import { $, el } from './ui/dom';
import { createLearnUi, type LearnUi } from './ui/learn';

const PROFILES: Record<string, Profile> = { flx4: FLX4_PROFILE, generic: GENERIC_PROFILE };

interface AppState {
  profile: Profile;
  map: ControlMap;
  rev: Record<string, string>;
  drills: Drill[];
  drill: Drill | null;
  run: DrillRun | null;
  settings: Settings;
  best: Record<string, number>;
  midi: MidiAccess;
  sounds: Sounds;
  tapTempo: TapTempo;
  learn: LearnUi | null;
  values: Record<string, number>;
  raf: number;
  startedAt: number;
}

const db = new TrainerDb();
const cv = $<HTMLCanvasElement>('cv');
const ctx = cv.getContext('2d')!;
const renderer = new LaneRenderer(ctx, themeFromCss());
const state: AppState = {
  profile: FLX4_PROFILE,
  map: {},
  rev: {},
  drills: builtinDrills(),
  drill: null,
  run: null,
  settings: null as unknown as Settings,
  best: {},
  midi: new MidiAccess(),
  sounds: new Sounds(),
  tapTempo: new TapTempo(),
  learn: null,
  values: {},
  raf: 0,
  startedAt: 0,
};

// ---------- boot ----------
async function boot(): Promise<void> {
  await migrateLegacy();
  state.settings = await db.getSettings();
  applyTheme();
  const profileSel = $<HTMLSelectElement>('profile');
  for (const p of Object.values(PROFILES)) profileSel.appendChild(el('option', { value: p.id }, p.name));
  profileSel.value = state.settings.lastProfile in PROFILES ? state.settings.lastProfile : 'flx4';
  profileSel.onchange = () => void setProfile(profileSel.value);
  await setProfile(profileSel.value);
  wireToolbar();
  wireMidi();
  wireKeyboard();
  wireResize();
  exposeTestHook();
}

async function migrateLegacy(): Promise<void> {
  if (await db.settings.get('settings')) return;
  const legacy = readLegacy(localStorage);
  if (legacy.map) await db.saveMap('generic', legacy.map);
  if (Object.keys(legacy.settings).length) await db.saveSettings({ ...legacy.settings, lastProfile: legacy.map ? 'generic' : 'flx4' });
  else await db.saveSettings({});
}

async function setProfile(id: string): Promise<void> {
  state.profile = PROFILES[id] ?? FLX4_PROFILE;
  state.map = await db.getMap(state.profile.id);
  state.rev = reverseMap(state.map);
  state.values = defaultValues(state.profile);
  state.best = await db.bestScores();
  state.learn = createLearnUi(state.profile, state.map, (map) => {
    state.rev = reverseMap(map);
    void db.saveMap(state.profile.id, map);
    fillDrillSelect();
    draw();
  });
  await db.saveSettings({ lastProfile: state.profile.id });
  fillDrillSelect();
  const sel = $<HTMLSelectElement>('drill');
  const want = state.settings.lastDrill;
  const ordered = sortedControlDrills();
  const first = ordered.find((d) => d.id === want) ?? ordered[0];
  if (first) {
    sel.value = first.id;
    loadDrill(first);
  }
}

function isControlDrill(d: Drill): boolean {
  return d.targets.every((t) => t.type !== 'note');
}

/** Control drills in browser order: tier, then level, then name. */
function sortedControlDrills(): Drill[] {
  return state.drills
    .filter(isControlDrill)
    .sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || (a.level ?? 99) - (b.level ?? 99) || a.name.localeCompare(b.name));
}

// ---------- drills ----------
function fillDrillSelect(): void {
  const sel = $<HTMLSelectElement>('drill');
  const current = sel.value;
  sel.innerHTML = '';
  const mapped = mappedControls(state.map);
  const caps = new Set(state.profile.capabilities);
  const list = sortedControlDrills();
  let tier = '';
  let og: HTMLOptGroupElement | null = null;
  for (const d of list) {
    if (d.tier !== tier) {
      tier = d.tier;
      og = el('optgroup', { label: tier });
      sel.appendChild(og);
    }
    const av = availability(d, mapped, { capabilities: caps });
    const reason = av.reasons
      .map((r) => (r.kind === 'unmapped' ? `unmapped: ${r.controls.join(', ')}` : r.kind === 'needsAudio' ? 'needs audio engine' : `needs ${r.hardware.join(', ')}`))
      .join(' · ');
    const o = el('option', { value: d.id }, d.name + (av.available ? '' : ` — ${reason}`));
    o.dataset.available = String(av.available);
    og!.appendChild(o);
  }
  if (current) sel.value = current;
  sel.onchange = () => {
    const d = state.drills.find((x) => x.id === sel.value);
    if (d) loadDrill(d);
  };
}

function loadDrill(d: Drill): void {
  state.drill = d;
  $<HTMLInputElement>('bpm').value = String(d.bpm);
  $('title').textContent = d.name;
  $('lesson').innerHTML = marked.parse(d.lesson || '## Loaded drill\n\nCustom drill from file.') as string;
  void db.saveSettings({ lastDrill: d.id });
  newRun();
}

function newRun(): void {
  const d = state.drill;
  if (!d) return;
  const s = state.settings;
  state.run = new DrillRun(d, {
    thresholds: resolveThresholds(d, s.thresholds),
    strictness: s.strictness,
    inputOffsetMs: s.inputOffsetMs,
    countInBars: s.countInBars,
    loop: s.loop,
    initialValues: state.values,
  });
  state.run.setBpm(Number($<HTMLInputElement>('bpm').value) || d.bpm, performance.now());
  $('playBtn').textContent = 'Start';
  $('cue').style.display = 'none';
  $('result').style.display = 'none';
  updateStats();
  draw();
}

$<HTMLInputElement>('drillfile').onchange = async (e) => {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (!f) return;
  try {
    const loaded = parseDrillFile(JSON.parse(await f.text())).map((d) => ({ ...d, tier: d.tier || 'Custom' }));
    for (const d of loaded) {
      const i = state.drills.findIndex((x) => x.id === d.id);
      if (i >= 0) state.drills[i] = d;
      else state.drills.push(d);
    }
    fillDrillSelect();
    const last = loaded[loaded.length - 1]!;
    $<HTMLSelectElement>('drill').value = last.id;
    loadDrill(last);
  } catch (err) {
    alert('Could not read drill:\n' + formatDrillError(err));
  }
  input.value = '';
};

// ---------- transport ----------
function startStop(): void {
  const run = state.run;
  if (!run) return;
  state.sounds.ensure();
  const now = performance.now();
  if (run.active) {
    run.stop(now);
    $('playBtn').textContent = 'Start';
    return;
  }
  if (run.phase === 'finished') newRun();
  state.startedAt = now;
  state.run!.start(now);
  $('playBtn').textContent = 'Stop';
  $('result').style.display = 'none';
  loop();
}

function wireToolbar(): void {
  $('playBtn').onclick = startStop;
  $('resetBtn').onclick = newRun;
  $<HTMLInputElement>('bpm').onchange = (e) => {
    const bpm = Number((e.target as HTMLInputElement).value) || state.drill?.bpm || 125;
    state.run?.setBpm(bpm, performance.now());
  };
  $('tapTempo').onclick = () => {
    const bpm = state.tapTempo.tap(performance.now());
    if (bpm) {
      $<HTMLInputElement>('bpm').value = String(bpm);
      state.run?.setBpm(bpm, performance.now());
    }
  };
  const toggle = (id: string, key: 'click' | 'loop' | 'autoStart') => {
    const b = $(id);
    b.classList.toggle('on', state.settings[key]);
    b.onclick = () => {
      state.settings[key] = !state.settings[key];
      b.classList.toggle('on', state.settings[key]);
      void db.saveSettings({ [key]: state.settings[key] });
      if (key === 'click') state.sounds.ensure();
      if (key === 'loop' && state.run && !state.run.active) newRun();
    };
  };
  toggle('clickBtn', 'click');
  toggle('loopBtn', 'loop');
  toggle('autoBtn', 'autoStart');
  const names = controlById(state.profile);
  $('autoBtn').textContent = `Start on ${names[state.settings.autoStartControl]?.name ?? state.settings.autoStartControl}`;
}

function wireKeyboard(): void {
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) && !state.learn?.isOpen) {
      e.preventDefault();
      startStop();
    }
  });
}

// ---------- MIDI ----------
function wireMidi(): void {
  const setStatus = (names: string[]) => {
    const on = names.length > 0;
    $('dot').classList.toggle('on', on);
    $('devname').textContent = on ? names.join(', ') : 'No controller found. Power it on, plug USB, click Connect.';
  };
  state.midi.onStateChange((inputs) => setStatus(inputs.map((i) => i.name)));
  state.midi.onEvent((ev, meta) => handleMidi(ev, meta.timeStamp));
  const connect = async () => {
    try {
      setStatus((await state.midi.connect()).map((i) => i.name));
    } catch (e) {
      $('devname').textContent = MidiAccess.supported ? 'MIDI access blocked. Allow MIDI for this page in the browser site settings.' : (e as Error).message;
    }
  };
  $('midiBtn').onclick = connect;
  if (MidiAccess.supported) void connect();
  else $('devname').textContent = 'No Web MIDI here. Use Chrome or Edge.';
}

function handleMidi(ev: MidiEvent, timeStamp: number): void {
  if (state.learn?.offer(ev)) return;
  const c = state.rev[ev.key];
  const names = controlById(state.profile);
  const valText = ev.kind === 'cc' ? ` · ${Math.round(ev.value * 100)}%` : '';
  $('lastin').textContent = `${c ? names[c]?.name ?? c : 'unmapped'} · ${ev.key}${valText}`;
  if (!c) return;
  const run = state.run;
  if (ev.kind === 'cc') {
    state.values[c] = ev.value;
    run?.onValue(c, ev.value, timeStamp);
  } else if (ev.kind === 'noteon') {
    if (run && !run.active && state.settings.autoStart && c === state.settings.autoStartControl) {
      startStop();
      return;
    }
    run?.onTap(c, timeStamp);
    updateStats();
  }
  if (!run?.active) draw();
}

// ---------- frame loop ----------
function loop(): void {
  cancelAnimationFrame(state.raf);
  const run = state.run;
  if (!run || !run.active) return;
  const now = performance.now();
  const r = run.tick(now);
  if (state.settings.click) for (const b of r.beats) if (b >= 0) state.sounds.click(b % run.transport.beatsPerBar === 0);
  const pos = run.pos(now);
  const cue = run.cue(pos, Object.fromEntries(state.profile.controls.map((c) => [c.id, c.name])));
  const cueEl = $('cue');
  if (cue) {
    cueEl.style.display = 'block';
    cueEl.textContent = cue.text;
  } else cueEl.style.display = 'none';
  updateStats();
  draw();
  if (r.ended) {
    $('playBtn').textContent = 'Start';
    cueEl.style.display = 'none';
    void finishRun();
    return;
  }
  state.raf = requestAnimationFrame(loop);
}

async function finishRun(): Promise<void> {
  const run = state.run;
  if (!run || !state.drill) return;
  const attempt = run.attempt(state.profile.id);
  await db.attempts.add(attempt);
  const prev = state.best[state.drill.id];
  const isPb = attempt.score != null && (prev == null || attempt.score > prev);
  if (isPb && attempt.score != null) state.best[state.drill.id] = attempt.score;
  const box = $('result');
  const medal = attempt.medal;
  box.innerHTML = '';
  box.appendChild(el('small', {}, state.drill.name));
  box.appendChild(el('b', {}, attempt.score == null ? '—' : `${attempt.score}%`));
  box.appendChild(el('div', { class: `medal ${medal ? 'medal-' + medal : ''}` }, medal ? medal : attempt.passed ? 'passed' : 'keep going'));
  box.appendChild(el('small', {}, isPb ? 'New personal best' : prev != null ? `Best ${prev}%` : ''));
  box.style.display = 'block';
  updateStats();
}

function updateStats(): void {
  const run = state.run;
  const drill = state.drill;
  if (!run || !drill) return;
  const st: RunStats = run.stats();
  $('sScore').textContent = st.score == null ? '—' : `${st.score}%`;
  $('sTiming').textContent = st.timingMeanMs == null ? '—' : String(st.timingMeanMs);
  $('sTrack').textContent = st.sub.tracking == null ? '—' : `${st.sub.tracking}%`;
  const best = state.best[drill.id];
  $('sBest').textContent = best == null ? '—' : `${best}%`;
  const tiers = $('tiers').querySelectorAll('b');
  tiers[0]!.textContent = String(st.tiers.perfect);
  tiers[1]!.textContent = String(st.tiers.great);
  tiers[2]!.textContent = String(st.tiers.ok);
  tiers[3]!.textContent = String(st.tiers.miss);
  tiers[4]!.textContent = String(run.extraPresses);
  const pos = run.pos(performance.now());
  const bb = run.transport.barBeat(pos);
  const names = controlById(state.profile);
  $('barinfo').textContent =
    run.phase === 'idle' || run.phase === 'finished'
      ? `Waiting for ${names[state.settings.autoStartControl]?.name ?? 'Start'} · ${drill.bars} bars at ${run.bpm} BPM`
      : pos < 0
        ? `Count-in · ${Math.ceil(-pos)}`
        : `Bar ${bb.bar} of ${Math.ceil(lengthBeats(drill) / run.transport.beatsPerBar)} · beat ${bb.beat}`;
}

// ---------- draw ----------
function draw(): void {
  const run = state.run;
  if (!run) return;
  const names = Object.fromEntries(state.profile.controls.map((c) => [c.id, c.name]));
  const kinds = Object.fromEntries(state.profile.controls.map((c) => [c.id, c.kind]));
  renderer.draw({
    lanes: run.lanes,
    states: run.states,
    values: run.values,
    flashes: run.flashes,
    names,
    kinds,
    mapped: mappedControls(state.map),
    pos: run.pos(performance.now()),
    hitWindowBeats: run.thresholds.tapWindowBeats,
  });
  if (!run.active && Object.keys(run.flashes).length) requestAnimationFrame(draw);
}

function wireResize(): void {
  const resize = () => {
    const r = cv.parentElement!.getBoundingClientRect();
    const W = Math.floor(r.width);
    const dpr = window.devicePixelRatio || 1;
    const H = Math.min(560, Math.max(380, Math.round(W * 0.45)));
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderer.resize(W, H);
    draw();
  };
  window.addEventListener('resize', resize);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    renderer.setTheme(themeFromCss());
    draw();
  });
  resize();
}

function applyTheme(): void {
  const t = state.settings.theme;
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  renderer.setTheme(themeFromCss());
}

// ---------- test hook (Playwright drives the app through this) ----------
function exposeTestHook(): void {
  (window as unknown as { __trainer: unknown }).__trainer = {
    injectMidi: (bytes: number[], timeStamp?: number) => state.midi.inject(bytes, timeStamp ?? performance.now()),
    setMap: (map: ControlMap) => {
      for (const k of Object.keys(state.map)) delete state.map[k];
      Object.assign(state.map, map);
      state.rev = reverseMap(state.map);
      fillDrillSelect();
      draw();
    },
    selectDrill: (id: string) => {
      const d = state.drills.find((x) => x.id === id);
      if (!d) throw new Error('no drill ' + id);
      $<HTMLSelectElement>('drill').value = id;
      loadDrill(d);
    },
    start: () => startStop(),
    now: () => performance.now(),
    startedAt: () => state.startedAt,
    state: () => ({
      drill: state.drill?.id ?? null,
      phase: state.run?.phase ?? null,
      pos: state.run?.pos(performance.now()) ?? null,
      stats: state.run?.stats() ?? null,
      extra: state.run?.extraPresses ?? 0,
      drills: state.drills.length,
      lanes: state.run?.lanes ?? [],
      thresholds: state.run?.thresholds ?? DEFAULT_THRESHOLDS,
      medal: medalFor(state.run?.stats().score),
    }),
  };
}

void boot();
