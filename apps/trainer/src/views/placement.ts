import { buildLadder, startPlacement, recordPlacement, placementResult, type PlacementState } from '@midi-trainer/engine';
import type { View } from '../router';
import { navigate } from '../router';
import { el } from '../ui/dom';

const KEY = 'midi-trainer:placement';

/** Placement test: drives the practice view drill by drill and records each score. */
export const placementView: View = (root, app, params) => {
  const ladder = buildLadder(app.drills);
  let state: PlacementState | null = null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw) as PlacementState;
  } catch {
    state = null;
  }
  const card = el('div', { class: 'panel' });
  root.appendChild(card);
  const scoreParam = params.query.get('score');
  if (state && scoreParam != null) {
    state = recordPlacement(state, scoreParam === 'null' ? null : Number(scoreParam));
    sessionStorage.setItem(KEY, JSON.stringify(state));
  }
  if (!state || params.query.get('reset')) {
    card.innerHTML = `<h2>Placement test</h2><p class="hint">${ladder.length} drills on the ladder, easiest to hardest. You start a few rungs up; a pass climbs two, a miss drops one; three misses end it (or eight drills). You get a 100–1900 score and a benchmark name.</p>`;
    const b = el('button', { class: 'primary', id: 'placementStart' }, 'Begin');
    b.onclick = () => {
      state = startPlacement(ladder);
      sessionStorage.setItem(KEY, JSON.stringify(state));
      navigate('placement');
    };
    card.appendChild(b);
    return;
  }
  if (state.finished) {
    const r = placementResult(state);
    card.innerHTML = `<div class="label">Placement result</div><b class="big" style="font-family:var(--display);font-size:72px;font-weight:800;display:block;line-height:1;margin:8px 0">${r.score}</b><p><b>${r.benchmark}</b></p><p class="hint">${state.steps.map((s) => `${app.drill(s.drillId)?.name ?? s.drillId}: ${s.score ?? '—'}% ${s.passed ? '✓' : '✗'}`).join(' · ')}</p>`;
    const again = el('button', {}, 'Take it again');
    again.onclick = () => {
      sessionStorage.removeItem(KEY);
      navigate('placement?reset=1');
    };
    card.appendChild(again);
    return;
  }
  const next = app.drill(state.ladder[state.index]!);
  card.innerHTML = `<h2>Placement · drill ${state.steps.length + 1}</h2><p>Next: <b>${next?.name ?? state.ladder[state.index]}</b> (${next?.tier}). Setbacks so far: ${state.setbacks} of 3.</p>`;
  const go = el('button', { class: 'primary' }, 'Play it');
  go.onclick = () => navigate(`practice/${encodeURIComponent(next!.id)}?placement=1`);
  const quit = el('button', {}, 'Quit');
  quit.onclick = () => {
    sessionStorage.removeItem(KEY);
    navigate('browse');
  };
  card.append(go, document.createTextNode(' '), quit);
};
