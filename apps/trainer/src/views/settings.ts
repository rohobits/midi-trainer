import { DEFAULT_THRESHOLDS, type Settings, type ScoringThresholds } from '@midi-trainer/engine';
import type { View } from '../router';
import { navigate } from '../router';
import { el, download } from '../ui/dom';
import { confirmDialog } from '../ui/dialog';

export const settingsView: View = (root, app) => {
  const s = app.settings;
  const page = el('div', { class: 'settings' });
  root.appendChild(page);
  const section = (title: string, hint?: string) => {
    const sec = el('section', { class: 'panel' });
    sec.appendChild(el('div', { class: 'label' }, title));
    if (hint) sec.appendChild(el('p', { class: 'hint', style: 'margin:4px 0 8px' }, hint));
    const form = el('div', { class: 'form' });
    sec.appendChild(form);
    page.appendChild(sec);
    return { sec, form };
  };
  const row = (form: HTMLElement, label: string, input: HTMLElement, hint?: string) => {
    const l = el('label');
    l.appendChild(document.createTextNode(label));
    if (hint) l.appendChild(el('span', {}, hint));
    l.appendChild(input);
    form.appendChild(l);
  };
  const num = (key: keyof Settings, min: number, max: number, step = 1) => {
    const i = el('input', { type: 'number', min: String(min), max: String(max), step: String(step), value: String(s[key]) });
    i.onchange = () => void app.saveSettings({ [key]: Number(i.value) } as Partial<Settings>);
    return i;
  };
  const range = (key: keyof Settings, min: number, max: number, step: number) => {
    const wrap = el('span', { class: 'row', style: 'gap:8px' });
    const i = el('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(s[key]) });
    const v = el('b', { class: 'mono' }, String(s[key]));
    i.oninput = () => (v.textContent = i.value);
    i.onchange = () => void app.saveSettings({ [key]: Number(i.value) } as Partial<Settings>);
    wrap.append(i, v);
    return wrap;
  };
  const bool = (key: keyof Settings) => {
    const i = el('input', { type: 'checkbox' });
    i.checked = !!s[key];
    i.onchange = () => void app.saveSettings({ [key]: i.checked } as Partial<Settings>);
    return i;
  };
  const sel = (key: keyof Settings, options: [string, string][]) => {
    const e = el('select');
    for (const [v, t] of options) e.appendChild(el('option', { value: v }, t));
    e.value = String(s[key]);
    if (e.selectedIndex < 0) e.selectedIndex = 0;
    e.onchange = () => void app.saveSettings({ [key]: e.value } as Partial<Settings>);
    return e;
  };

  const look = section('Look and sound');
  row(look.form, 'Theme', sel('theme', [['dark', 'Booth (dark)'], ['light', 'Practice room (light)']]), 'cosmetic themes unlock on Progress');
  row(look.form, 'Reduced motion', bool('reducedMotion'), 'no shake, no sparks, instant count-ups');
  row(look.form, 'Mute game sounds', bool('muteSfx'), 'hits, misses, medals; the metronome stays');
  row(look.form, 'Highway lookahead (beats)', range('lookahead', 4, 16, 1), 'how far ahead you see');
  row(look.form, 'Highway perspective', range('fov', 0, 3, 0.1), '0 is flat, 3 is steep');
  row(look.form, 'On-screen controller', bool('showController'));

  const play = section('Practice');
  row(play.form, 'Daily goal (minutes)', num('goalMinutes', 1, 120));
  row(play.form, 'Metronome', bool('click'));
  row(play.form, 'Count-in bars', num('countInBars', 0, 4));
  row(play.form, 'Loop by default', bool('loop'));
  row(play.form, 'Auto-start on', sel('autoStartControl', app.profile.controls.filter((c) => c.kind === 'tap').map((c) => [c.id, c.name])), 'press it while stopped to start the clock');
  row(play.form, 'Auto-start enabled', bool('autoStart'));
  row(play.form, 'Auto-BPM ladder', bool('autoBpm'), 'pass at 80% → 90% → 100%');
  row(play.form, 'Master mode', bool('masterMode'), 'hide the highway after three golds');
  row(play.form, 'Performance mode', bool('performanceMode'), 'multiplier, Euphoria (E), energy');
  row(play.form, 'Show hit window', bool('showHitWindow'));
  row(play.form, 'Follow MIDI clock', bool('followMidiClock'), 'drill BPM tracks an incoming clock');
  row(play.form, 'Piano mode', sel('noteMode', [['wait', 'Wait for me'], ['play', 'Play along']]));
  row(play.form, 'Piano hands', sel('hand', [['B', 'Both'], ['R', 'Right'], ['L', 'Left']]));

  const judge = section('Judging', 'Tiers are Perfect ±40, Great ±90, OK ±140 ms at strictness 1. A drill can override its own thresholds.');
  row(judge.form, 'Strictness', range('strictness', 0.25, 3, 0.25), '0.5 is twice as strict');
  row(judge.form, 'Input offset (ms)', num('inputOffsetMs', -200, 200), 'positive if your presses register late');
  const keys: (keyof ScoringThresholds)[] = ['tapWindowBeats', 'tapZeroMs', 'rampHit', 'rampZero', 'noteWindowBeats', 'tierPerfectMs', 'tierGreatMs', 'tierOkMs'];
  const labels: Record<keyof ScoringThresholds, string> = {
    tapWindowBeats: 'Tap window (± beats)', tapZeroMs: 'Tap score reaches 0 at (ms)', rampHit: 'Ramp hit below mean error', rampZero: 'Ramp score reaches 0 at',
    noteWindowBeats: 'Note window (± beats)', tierPerfectMs: 'Perfect (ms)', tierGreatMs: 'Great (ms)', tierOkMs: 'OK (ms)',
  };
  for (const k of keys) {
    const i = el('input', { type: 'number', step: 'any', value: String(s.thresholds[k] ?? DEFAULT_THRESHOLDS[k]) });
    i.onchange = () => {
      const v = Number(i.value);
      const next = { ...app.settings.thresholds };
      if (!v || v === DEFAULT_THRESHOLDS[k]) delete next[k];
      else next[k] = v;
      void app.saveSettings({ thresholds: next });
    };
    row(judge.form, labels[k], i, `default ${DEFAULT_THRESHOLDS[k]}`);
  }
  const resetTh = el('button', { class: 'small', style: 'margin-top:10px' }, 'Reset thresholds');
  resetTh.onclick = () => void app.saveSettings({ thresholds: {} }).then(() => navigate('settings'));
  judge.sec.appendChild(resetTh);

  const cal = el('section', { class: 'panel' });
  cal.innerHTML = `<div class="label">Calibration</div><p class="hint" style="margin:4px 0 10px">Tap along with sixteen clicks; the median of your early/late bias becomes the input offset for this device.</p>`;
  const calRow = el('div', { class: 'row' });
  const calBtn = el('button', { class: 'primary' }, 'Run the wizard');
  calBtn.onclick = () => navigate('calibrate');
  const onboardBtn = el('button', {}, 'Re-run first-time setup');
  onboardBtn.onclick = () => navigate('welcome');
  calRow.append(calBtn, onboardBtn);
  cal.appendChild(calRow);
  const offsets = Object.entries(s.deviceOffsets);
  if (offsets.length) cal.appendChild(el('p', { class: 'hint', style: 'margin-top:8px' }, 'Saved per device: ' + offsets.map(([d, o]) => `${d}: ${o} ms`).join(' · ')));
  page.appendChild(cal);

  const data = el('section', { class: 'panel' });
  data.innerHTML = `<div class="label">Your data</div><p class="hint" style="margin:4px 0 10px">Everything lives in this browser (IndexedDB). Export a backup before clearing site data or moving machines.</p>`;
  const rowEl = el('div', { class: 'row' });
  const exp = el('button', {}, 'Export backup');
  exp.onclick = async () => download(`midi-trainer-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await app.db.exportAll()));
  const imp = el('span', { class: 'file' });
  imp.appendChild(el('button', { type: 'button' }, 'Import backup'));
  const impInput = el('input', { type: 'file', accept: '.json' });
  impInput.onchange = async () => {
    const f = impInput.files?.[0];
    if (!f) return;
    try {
      await app.db.importAll(JSON.parse(await f.text()));
      await app.reloadDrills();
      await app.reloadAttempts();
      app.settings = await app.db.getSettings();
      app.applyTheme();
      app.toast('Backup imported.');
      navigate('dashboard');
    } catch (e) {
      app.toast('Could not import: ' + (e as Error).message, 5000);
    }
  };
  imp.appendChild(impInput);
  const wipe = el('button', { class: 'ghost' }, 'Delete all attempts');
  wipe.onclick = async () => {
    if (!(await confirmDialog('Delete every attempt?', 'Maps and settings stay. This cannot be undone.', { confirm: 'Delete', danger: true }))) return;
    await app.db.attempts.clear();
    await app.reloadAttempts();
    app.toast('Attempts deleted.');
  };
  rowEl.append(exp, imp, wipe);
  data.appendChild(rowEl);
  page.appendChild(data);

  const about = el('section', { class: 'panel' });
  about.innerHTML = `<div class="label">Hardware</div><p class="hint" style="margin-top:4px">Profile ${app.profile.name}. Mapped controls <b class="mono">${app.mapped().size}</b> of <b class="mono">${app.profile.controls.length}</b>. ${app.deviceName ? `Device: ${app.deviceName}.` : 'No device connected.'} Use Map controls in the top bar, then Export JSON to keep a copy.</p>`;
  page.appendChild(about);
};
