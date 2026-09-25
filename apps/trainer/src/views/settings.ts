import { DEFAULT_THRESHOLDS, type Settings, type ScoringThresholds } from '@midi-trainer/engine';
import type { View } from '../router';
import { navigate } from '../router';
import { el, download } from '../ui/dom';

export const settingsView: View = (root, app) => {
  const s = app.settings;
  root.appendChild(el('h2', {}, 'Settings'));
  const form = el('div', { class: 'form' });
  const row = (label: string, input: HTMLElement, hint?: string) => {
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
    e.onchange = () => void app.saveSettings({ [key]: e.value } as Partial<Settings>);
    return e;
  };
  row('Theme', sel('theme', [['system', 'System'], ['dark', 'Dark'], ['light', 'Light']]), 'cosmetic themes unlock on the Progress page');
  row('Reduced motion', bool('reducedMotion'));
  row('Daily goal (minutes)', num('goalMinutes', 1, 120));
  row('Metronome', bool('click'));
  row('Count-in bars', num('countInBars', 0, 4));
  row('Loop by default', bool('loop'));
  row('Auto-start on', sel('autoStartControl', app.profile.controls.filter((c) => c.kind === 'tap').map((c) => [c.id, c.name])), 'press it while stopped to start the clock');
  row('Auto-start enabled', bool('autoStart'));
  row('Judgement strictness', num('strictness', 0.25, 3, 0.25), '1 = Perfect ±40 / Great ±90 / OK ±140 ms; 0.5 = twice as strict');
  row('Input offset (ms)', num('inputOffsetMs', -200, 200), 'positive if your presses register late; use the wizard');
  row('Show hit window', bool('showHitWindow'));
  row('Auto-BPM ladder', bool('autoBpm'), 'pass at 80% → 90% → 100%');
  row('Master mode', bool('masterMode'), 'hide the highway after three golds');
  row('Performance mode', bool('performanceMode'), 'multiplier, Euphoria (press E), energy');
  row('Follow MIDI clock', bool('followMidiClock'), 'when a device sends clock, the drill BPM tracks it');
  row('Piano mode', sel('noteMode', [['wait', 'Wait for me'], ['play', 'Play along']]));
  row('Piano hands', sel('hand', [['B', 'Both'], ['R', 'Right'], ['L', 'Left']]));
  root.appendChild(form);

  const th = el('div', { class: 'card', style: 'margin-top:14px' });
  th.appendChild(el('h2', {}, 'Scoring thresholds (global; a drill can override)'));
  const tf = el('div', { class: 'form' });
  const keys: (keyof ScoringThresholds)[] = ['tapWindowBeats', 'tapZeroMs', 'rampHit', 'rampZero', 'noteWindowBeats', 'tierPerfectMs', 'tierGreatMs', 'tierOkMs'];
  const labels: Record<keyof ScoringThresholds, string> = {
    tapWindowBeats: 'Tap window (± beats)', tapZeroMs: 'Tap score reaches 0 at (ms)', rampHit: 'Ramp hit below mean error', rampZero: 'Ramp score reaches 0 at',
    noteWindowBeats: 'Note window (± beats)', tierPerfectMs: 'Perfect (ms)', tierGreatMs: 'Great (ms)', tierOkMs: 'OK (ms)',
  };
  for (const k of keys) {
    const l = el('label');
    l.appendChild(document.createTextNode(labels[k]));
    l.appendChild(el('span', {}, `default ${DEFAULT_THRESHOLDS[k]}`));
    const i = el('input', { type: 'number', step: 'any', value: String(s.thresholds[k] ?? DEFAULT_THRESHOLDS[k]) });
    i.onchange = () => {
      const v = Number(i.value);
      const next = { ...app.settings.thresholds };
      if (!v || v === DEFAULT_THRESHOLDS[k]) delete next[k];
      else next[k] = v;
      void app.saveSettings({ thresholds: next });
    };
    l.appendChild(i);
    tf.appendChild(l);
  }
  th.appendChild(tf);
  const resetTh = el('button', { class: 'small', style: 'margin-top:10px' }, 'Reset thresholds');
  resetTh.onclick = () => void app.saveSettings({ thresholds: {} }).then(() => navigate('settings'));
  th.appendChild(resetTh);
  root.appendChild(th);

  const cal = el('div', { class: 'card', style: 'margin-top:14px' });
  cal.innerHTML = `<h2>Calibration</h2><p>Tap along with sixteen clicks; the median of your early/late bias becomes the input offset for this device.</p>`;
  const calBtn = el('button', { class: 'primary' }, 'Run the wizard');
  calBtn.onclick = () => navigate('calibrate');
  cal.appendChild(calBtn);
  const offsets = Object.entries(s.deviceOffsets);
  if (offsets.length) cal.appendChild(el('p', { class: 'hint' }, 'Saved per device: ' + offsets.map(([d, o]) => `${d}: ${o} ms`).join(' · ')));
  root.appendChild(cal);

  const data = el('div', { class: 'card', style: 'margin-top:14px' });
  data.appendChild(el('h2', {}, 'Your data'));
  data.appendChild(el('p', { class: 'hint' }, 'Everything lives in this browser (IndexedDB). Export a backup before clearing site data or moving machines.'));
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
      alert('Could not import: ' + (e as Error).message);
    }
  };
  imp.appendChild(impInput);
  const wipe = el('button', {}, 'Delete all attempts');
  wipe.onclick = async () => {
    if (!confirm('Delete every attempt? Maps and settings stay.')) return;
    await app.db.attempts.clear();
    await app.reloadAttempts();
    app.toast('Attempts deleted.');
  };
  rowEl.append(exp, imp, wipe);
  data.appendChild(rowEl);
  root.appendChild(data);

  const about = el('div', { class: 'card', style: 'margin-top:14px' });
  about.innerHTML = `<h2>Hardware</h2><p class="hint">Profile: ${app.profile.name}. Mapped controls: ${app.mapped().size} of ${app.profile.controls.length}. ${app.deviceName ? `Device: ${app.deviceName}.` : 'No device connected.'} Use Map controls in the header, then Export JSON to keep a copy.</p>`;
  root.appendChild(about);
};
