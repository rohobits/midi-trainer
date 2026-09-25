import { DrillRun, HighwayRenderer, highwayThemeFromCss, resolveThresholds, lengthBeats, laneGroups, type AttemptRecord, type Drill } from '@midi-trainer/engine';
import type { View } from '../router';
import { navigate } from '../router';
import { el } from '../ui/dom';
import { createStage } from '../ui/stage';
import { icon } from '../ui/icons';

/** Rebuild the run by replaying the input log against the judges, so hits and misses match what was scored. */
export function reconstruct(drill: Drill, attempt: AttemptRecord, kinds: Record<string, 'tap' | 'cc' | 'rel' | 'switch'>): DrillRun {
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
  let resize: () => void = () => {};
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
    const bar = el('div', { class: 'rail' });
    const playBtn = el('button', { class: 'primary', id: 'replayPlay' }, 'Play');
    const slider = el('input', { type: 'range', min: '-4', max: String(run.length + 2), step: '0.05', value: '-4', style: 'flex:1;min-width:240px', id: 'scrub', 'aria-label': 'Scrub' });
    const posLabel = el('span', { class: 'mono' });
    const back = el('button', { class: 'ghost' });
    back.appendChild(icon('prev'));
    back.appendChild(document.createTextNode(' History'));
    back.onclick = () => navigate(`history/${encodeURIComponent(drill.id)}`);
    bar.append(back, playBtn, slider, posLabel);
    holder.appendChild(bar);
    const stage = createStage(holder);
    const renderer = new HighwayRenderer(stage.ctx, highwayThemeFromCss());
    renderer.setReducedMotion(app.reducedMotion);
    renderer.setFov(app.settings.fov);
    const groups = laneGroups(app.profile);
    stage.name.textContent = `${drill.name} · replay`;
    stage.score.textContent = attempt.score == null ? '—' : String(attempt.score);
    stage.acc.textContent = `${new Date(attempt.startedAt).toLocaleDateString()} · ${attempt.medal ?? 'no medal'}`;
    const bpb = drill.timeSig?.[0] ?? 4;
    const total = lengthBeats(drill);
    const ticks: { at: number; phrase: boolean }[] = [];
    for (let b = bpb; b < total; b += bpb) ticks.push({ at: b / total, phrase: b % (bpb * 8) === 0 });
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
    let firedUpTo = -Infinity;
    const frameAt = (p: number) => ({
      lanes: run.lanes,
      states: run.states,
      values: Object.assign(values, valuesAt(p)),
      names,
      kinds,
      groups,
      mapped: new Set(run.lanes),
      pos: p,
      beatsPerBar: bpb,
      lookahead: app.settings.lookahead,
      hitWindowBeats: run.thresholds.tapWindowBeats,
    });
    const draw = () => {
      const bb = run.transport.barBeat(pos);
      stage.sub.textContent = pos < 0 ? 'before start' : `bar ${bb.bar} · beat ${bb.beat}`;
      posLabel.textContent = `${pos.toFixed(2)} beats`;
      stage.next.textContent = `${attempt.inputLog.length} inputs logged`;
      stage.setProgress(Math.max(0, pos) / total, ticks);
      const now = performance.now();
      const frame = frameAt(pos);
      if (playing) {
        for (const e of log) {
          if (e.t <= firedUpTo || e.t > pos) continue;
          if (kinds[e.c] === 'tap' && e.v === 1) {
            const st = run.states.find((s) => s.kind === 'tap' && s.c === e.c && s.hitAt != null && Math.abs(s.hitAt - e.t) < 0.02);
            if (st && st.kind === 'tap') renderer.pushEvent({ kind: 'hit', lane: e.c, tier: st.tier, errMs: st.errMs }, frame, now);
            else renderer.pushEvent({ kind: 'press', lane: e.c, ok: false }, frame, now);
          }
        }
        firedUpTo = pos;
      }
      renderer.draw(frame, now);
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
        firedUpTo = pos;
        raf = requestAnimationFrame(tick);
      }
    };
    slider.oninput = () => {
      pos = Number(slider.value);
      firedUpTo = pos;
      renderer.effects.clear();
      draw();
    };
    resize = () => {
      const { w, h, dpr } = stage.fit(0.52);
      renderer.resize(w, h, dpr);
      draw();
    };
    window.addEventListener('resize', resize);
    resize();
    const stats = el('div', { class: 'panel', style: 'margin-top:14px' });
    stats.innerHTML = `<h2>Scored as</h2><div class="stats"><div class="stat"><b>${attempt.score ?? '—'}</b><span>score</span></div><div class="stat"><b>${attempt.timingMeanMs ?? '—'}</b><span>avg ms</span></div><div class="stat"><b>${attempt.subScores.tracking ?? '—'}</b><span>tracking</span></div><div class="stat"><b>${attempt.extraPresses}</b><span>extra presses</span></div></div><p class="hint">The highway is rebuilt from your input log: lit targets were hits, dim red ones were misses, faders follow your recorded movement as you scrub.</p>`;
    holder.appendChild(stats);
  })();
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  };
};
