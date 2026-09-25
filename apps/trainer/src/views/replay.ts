import { DrillRun, LaneRenderer, themeFromCss, resolveThresholds, lengthBeats, type AttemptRecord, type Drill } from '@midi-trainer/engine';
import type { View } from '../router';
import { navigate } from '../router';
import { el } from '../ui/dom';
import { createStage } from '../ui/stage';

/** Rebuild the run by replaying the input log against the judges, so hits and misses match what was scored. */
export function reconstruct(drill: Drill, attempt: AttemptRecord, kinds: Record<string, 'tap' | 'cc' | 'rel'>): DrillRun {
  const run = new DrillRun(drill, { thresholds: resolveThresholds(drill), strictness: attempt.strictness, kinds, tempoScale: attempt.tempoScale ?? 1 });
  const msPerBeat = 60000 / run.bpm;
  run.start(0);
  const events = [...attempt.inputLog].sort((a, b) => a.t - b.t);
  let lastTick = 0;
  for (const e of events) {
    const ts = e.t * msPerBeat;
    for (let t = lastTick; t < ts; t += 16) run.tick(t);
    lastTick = ts;
    if (kinds[e.c] === 'cc') run.onValue(e.c, e.v, ts);
    else if (kinds[e.c] === 'rel') run.onRel(e.c, e.v, ts);
    else if (e.v === 1) run.onTap(e.c, ts);
  }
  const end = (lengthBeats(drill) + 3) * msPerBeat;
  for (let t = lastTick; t <= end; t += 16) run.tick(t);
  return run;
}

export const replayView: View = (root, app, params) => {
  const id = Number(params.id);
  let raf = 0;
  let playing = false;
  let pos = 0;
  let lastTs = 0;
  const holder = el('div');
  root.appendChild(holder);
  void (async () => {
    const attempt = await app.db.attempts.get(id);
    const drill = attempt ? app.drill(attempt.drillId) : undefined;
    if (!attempt || !drill) {
      holder.appendChild(el('p', {}, 'Attempt not found.'));
      return;
    }
    const kinds = app.kinds();
    const run = reconstruct(drill, attempt, kinds);
    const values: Record<string, number> = { ...run.values };
    const names = app.names();
    holder.appendChild(el('h2', {}, `${drill.name} · replay · ${new Date(attempt.startedAt).toLocaleString()} · ${attempt.score ?? '—'}%`));
    const bar = el('div', { class: 'toolbar' });
    const playBtn = el('button', { class: 'primary', id: 'replayPlay' }, 'Play');
    const slider = el('input', { type: 'range', min: '-4', max: String(run.length + 2), step: '0.05', value: '-4', style: 'flex:1;min-width:240px', id: 'scrub' });
    const posLabel = el('span', {});
    const back = el('button', {}, 'Back to history');
    back.onclick = () => navigate(`history/${encodeURIComponent(drill.id)}`);
    bar.append(playBtn, slider, posLabel, back);
    holder.appendChild(bar);
    const stage = createStage(holder);
    const renderer = new LaneRenderer(stage.ctx, themeFromCss());
    stage.title.textContent = drill.name;
    const log = [...attempt.inputLog].sort((a, b) => a.t - b.t);
    const valuesAt = (p: number) => {
      const v: Record<string, number> = { ...run.values };
      for (const l of run.lanes) v[l] = 0;
      for (const e of log) {
        if (e.t > p) break;
        if (kinds[e.c] === 'cc') v[e.c] = e.v;
      }
      return v;
    };
    const flashesAt = (p: number) => {
      const f: Record<string, { kind: 'ok' | 'bad'; tier: null; errMs: null; until: number }> = {};
      for (const e of log) if (kinds[e.c] === 'tap' && e.v === 1 && e.t <= p && e.t > p - 0.25) f[e.c] = { kind: 'ok', tier: null, errMs: null, until: Infinity };
      return f;
    };
    const draw = () => {
      const bb = run.transport.barBeat(pos);
      stage.barinfo.textContent = pos < 0 ? 'Before start' : `Bar ${bb.bar} · beat ${bb.beat}`;
      posLabel.textContent = `${pos.toFixed(2)} beats`;
      renderer.draw({ lanes: run.lanes, states: run.states, values: Object.assign(values, valuesAt(pos)), flashes: flashesAt(pos), names, kinds, mapped: new Set(run.lanes), pos, hitWindowBeats: run.thresholds.tapWindowBeats });
    };
    const tick = (ts: number) => {
      if (!playing) return;
      if (!lastTs) lastTs = ts;
      pos += ((ts - lastTs) * run.bpm) / 60000;
      lastTs = ts;
      slider.value = String(pos);
      draw();
      if (pos >= run.length + 2) {
        playing = false;
        playBtn.textContent = 'Play';
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    playBtn.onclick = () => {
      playing = !playing;
      playBtn.textContent = playing ? 'Pause' : 'Play';
      lastTs = 0;
      if (playing) {
        if (pos >= run.length + 2) pos = -4;
        raf = requestAnimationFrame(tick);
      }
    };
    slider.oninput = () => {
      pos = Number(slider.value);
      draw();
    };
    const resize = () => {
      const { w, h } = stage.fit();
      renderer.resize(w, h);
      draw();
    };
    window.addEventListener('resize', resize);
    resize();
    const stats = el('div', { class: 'card', style: 'margin-top:14px' });
    stats.innerHTML = `<h2>Scored as</h2><p>${attempt.score ?? '—'}% · ${attempt.medal ?? 'no medal'} · timing ${attempt.timingMeanMs ?? '—'} ms · tracking ${attempt.subScores.tracking ?? '—'}% · extra presses ${attempt.extraPresses}</p><p class="hint">The lanes show the run rebuilt from your input log: green targets were hits, red were misses, faders follow your recorded movement as you scrub.</p>`;
    holder.appendChild(stats);
  })();
  return () => cancelAnimationFrame(raf);
};
