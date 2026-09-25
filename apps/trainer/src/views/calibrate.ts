import type { View } from '../router';
import { navigate } from '../router';
import { el } from '../ui/dom';

/**
 * Rhythm Doctor style two-phase calibration: a count-in, then sixteen clicks at 120 BPM
 * where the user taps any mapped pad (or Space). The median signed error is the input
 * offset. Positive = presses arrive late relative to the click.
 */
export const calibrateView: View = (root, app) => {
  const BPM = 120;
  const N = 16;
  const COUNT = 4;
  const card = el('div', { class: 'card wizard' });
  card.innerHTML = `<h2>Calibrate input timing</h2><p>Tap a pad on your controller (or press <kbd>Space</kbd>) on every click. Four count-in clicks, then sixteen measured. Keep your usual hand position.</p>`;
  const step = el('div', { class: 'step' }, 'Ready');
  const startBtn = el('button', { class: 'primary' }, 'Start');
  const result = el('div');
  card.append(step, startBtn, result);
  root.appendChild(card);
  let clicks: number[] = [];
  let taps: number[] = [];
  let timer = 0;
  let running = false;
  const period = 60000 / BPM;

  function finish(): void {
    running = false;
    const errs: number[] = [];
    for (const c of clicks) {
      let best: number | null = null;
      for (const t of taps) {
        const e = t - c;
        if (Math.abs(e) < period / 2 && (best == null || Math.abs(e) < Math.abs(best))) best = e;
      }
      if (best != null) errs.push(best);
    }
    if (errs.length < 6) {
      step.textContent = 'Not enough taps';
      result.innerHTML = '<p class="hint">Fewer than six clicks got a tap. Try again and tap on every click.</p>';
      startBtn.textContent = 'Retry';
      startBtn.disabled = false;
      return;
    }
    const sorted = [...errs].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
    const sd = Math.sqrt(errs.reduce((a, b) => a + (b - mean) ** 2, 0) / errs.length);
    const offset = Math.round(median);
    step.textContent = `${offset > 0 ? '+' : ''}${offset} ms`;
    result.innerHTML = `<p>Median ${offset} ms (${offset > 0 ? 'late' : offset < 0 ? 'early' : 'on'}), spread ±${Math.round(sd)} ms over ${errs.length} taps.</p>`;
    const apply = el('button', { class: 'primary' }, `Use ${offset} ms as the input offset`);
    apply.onclick = async () => {
      const deviceOffsets = { ...app.settings.deviceOffsets };
      if (app.deviceName) deviceOffsets[app.deviceName] = offset;
      await app.saveSettings({ inputOffsetMs: offset, deviceOffsets });
      app.toast(`Input offset set to ${offset} ms.`);
      navigate('settings');
    };
    result.appendChild(apply);
    startBtn.textContent = 'Run again';
    startBtn.disabled = false;
  }

  function start(): void {
    app.sounds.ensure();
    clicks = [];
    taps = [];
    running = true;
    startBtn.disabled = true;
    result.innerHTML = '';
    let i = 0;
    const t0 = performance.now() + 500;
    const fire = () => {
      const at = t0 + i * period;
      const wait = at - performance.now();
      timer = window.setTimeout(() => {
        const now = performance.now();
        app.sounds.click(i % 4 === 0);
        if (i >= COUNT) clicks.push(now);
        step.textContent = i < COUNT ? `${COUNT - i}` : `${i - COUNT + 1} / ${N}`;
        i++;
        if (i < COUNT + N) fire();
        else timer = window.setTimeout(finish, period);
      }, Math.max(0, wait));
    };
    fire();
  }
  startBtn.onclick = start;
  const off = app.on('control', (ev) => {
    if (running && ev.kind === 'tap') taps.push(ev.timeStamp - 0);
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space' && running) {
      e.preventDefault();
      taps.push(performance.now());
    }
  };
  document.addEventListener('keydown', onKey);
  return () => {
    clearTimeout(timer);
    off();
    document.removeEventListener('keydown', onKey);
  };
};
