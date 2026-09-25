import type { View } from '../router';
import { navigate } from '../router';
import { el } from '../ui/dom';

/**
 * Rhythm Doctor style two-phase calibration: a count-in, then sixteen clicks at 120 BPM
 * where the user taps any mapped pad (or Space). The median signed error is the input
 * offset. Positive = presses arrive late relative to the click. A live scatter shows each
 * tap's error as a dot on a ±150 ms axis, with the running median as a needle.
 */
export const calibrateView: View = (root, app, params) => {
  const BPM = 120;
  const N = 16;
  const COUNT = 4;
  const card = el('div', { class: 'panel wizard' });
  card.innerHTML = `<h2>Calibrate input timing</h2><p class="hint">Tap a pad on your controller (or press <kbd>Space</kbd>) on every click. Four count-in clicks, then sixteen measured. Keep your usual hand position.</p>`;
  const step = el('div', { class: 'step' }, 'Ready');
  const scatter = el('div', { class: 'scatter' });
  scatter.innerHTML = `<div class="axis"><span>−150</span><span>early</span><span class="zero">0</span><span>late</span><span>+150</span></div><div class="dots" id="calDots"></div><i class="needle" id="calNeedle" style="display:none"></i>`;
  const startBtn = el('button', { class: 'primary' }, 'Start');
  const result = el('div', { style: 'margin-top:12px' });
  card.append(step, scatter, startBtn, result);
  root.appendChild(card);
  const dots = scatter.querySelector<HTMLElement>('#calDots')!;
  const needle = scatter.querySelector<HTMLElement>('#calNeedle')!;
  let clicks: number[] = [];
  let taps: number[] = [];
  let timer = 0;
  let running = false;
  const period = 60000 / BPM;
  const errs: number[] = [];

  function plot(err: number): void {
    errs.push(err);
    const x = 50 + Math.max(-50, Math.min(50, (err / 150) * 50));
    const dot = el('i', { style: `left:${x.toFixed(1)}%`, class: Math.abs(err) < 40 ? 'p' : Math.abs(err) < 90 ? 'g' : 'o' });
    dots.appendChild(dot);
    const sorted = [...errs].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    needle.style.display = 'block';
    needle.style.left = `${(50 + Math.max(-50, Math.min(50, (median / 150) * 50))).toFixed(1)}%`;
  }

  function finish(): void {
    running = false;
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
    result.innerHTML = `<p>Median <b class="mono">${offset} ms</b> (${offset > 0 ? 'late' : offset < 0 ? 'early' : 'on'}), spread ±${Math.round(sd)} ms over ${errs.length} taps.</p>`;
    const apply = el('button', { class: 'primary', style: 'margin-top:8px' }, `Use ${offset} ms as the input offset`);
    apply.onclick = async () => {
      const deviceOffsets = { ...app.settings.deviceOffsets };
      if (app.deviceName) deviceOffsets[app.deviceName] = offset;
      await app.saveSettings({ inputOffsetMs: offset, deviceOffsets });
      app.toast(`Input offset set to ${offset} ms.`);
      navigate(params.query.get('onboard') ? 'welcome?step=4' : 'settings');
    };
    result.appendChild(apply);
    startBtn.textContent = 'Run again';
    startBtn.disabled = false;
  }

  function judgeTap(t: number): void {
    // match to the nearest click that has not been claimed yet
    let bestI = -1;
    let best = Infinity;
    clicks.forEach((c, i) => {
      const e = t - c;
      if (Math.abs(e) < period / 2 && Math.abs(e) < Math.abs(best) && !taps.includes(i)) {
        best = e;
        bestI = i;
      }
    });
    if (bestI >= 0) {
      taps.push(bestI);
      plot(best);
    }
  }

  function start(): void {
    app.unlockAudio();
    app.sounds.ensure();
    clicks = [];
    taps = [];
    errs.length = 0;
    dots.innerHTML = '';
    needle.style.display = 'none';
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
    if (running && ev.kind === 'tap') judgeTap(ev.timeStamp);
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space' && running) {
      e.preventDefault();
      judgeTap(performance.now());
    }
  };
  document.addEventListener('keydown', onKey);
  return () => {
    clearTimeout(timer);
    off();
    document.removeEventListener('keydown', onKey);
  };
};
