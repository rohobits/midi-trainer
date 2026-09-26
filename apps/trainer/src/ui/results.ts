import type { AttemptRecord, Drill } from '@midi-trainer/engine';
import { el } from './dom';
import type { Sfx } from './sfx';

export interface ResultsInput {
  drill: Drill;
  attempt: AttemptRecord;
  isPb: boolean;
  prevBest: number | null;
  xp: number;
  leveledUp: boolean;
  level: number;
  streakLine: string;
  failed?: boolean;
  reduced: boolean;
  sfx: Sfx;
  onAgain: () => void;
  onSlower: () => void;
  onNext: () => void;
  onHistory: () => void;
}

/** Coach line from the numbers. */
export function coachLine(a: AttemptRecord): string {
  if (a.score == null) return 'Nothing was judged. Check the mapping and try again.';
  const bias = a.perTarget.filter((p) => p.hit && p.err != null && Math.abs(p.err) < 400).map((p) => p.err as number);
  const mean = bias.length ? bias.reduce((x, y) => x + y, 0) / bias.length : 0;
  const misses = a.tiers.miss;
  if (a.score >= 96) return `Clean run. ${bias.length ? `Timing ${mean > 0 ? '+' : ''}${Math.round(mean)} ms on average.` : ''}`.trim();
  if (misses && misses >= a.tiers.perfect + a.tiers.great) return 'Most targets were missed. Slow the tempo down and use wait mode until the shape is in your hands.';
  if (Math.abs(mean) > 25) return mean > 0 ? `You are landing late by ${Math.round(mean)} ms on average. Move a hair earlier; aim for the kick, not after it.` : `You are landing early by ${Math.round(-mean)} ms on average. Let the beat arrive before you press.`;
  if (a.subScores.tracking != null && a.subScores.tracking < 80) return 'Timing is fine; the fader path drifted. Watch the live marker and keep your hand moving evenly.';
  if (a.timingSdMs != null && a.timingSdMs > 40) return 'On average you are on time, but the spread is wide. Consistency beats speed: try 80% tempo.';
  if (a.passed) return `Locked in. ${bias.length ? `Timing ${mean > 0 ? '+' : ''}${Math.round(mean)} ms on average.` : 'Keep it there.'}`;
  return 'Close. One more pass at this tempo before moving on.';
}

/** Results choreography: panel → arc + count-up → medal stamp → rows → stars. */
export function showResults(host: HTMLElement, r: ResultsInput): void {
  const a = r.attempt;
  host.innerHTML = '';
  const sheet = el('div', { class: 'sheet' });
  const top = el('div', { class: 'top' });
  const arc = el('div', { class: 'arc' });
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 132 132');
  const bgc = document.createElementNS(NS, 'circle');
  bgc.setAttribute('cx', '66');
  bgc.setAttribute('cy', '66');
  bgc.setAttribute('r', '58');
  bgc.setAttribute('fill', 'none');
  bgc.setAttribute('stroke', 'var(--s3)');
  bgc.setAttribute('stroke-width', '8');
  const fg = document.createElementNS(NS, 'circle');
  fg.setAttribute('cx', '66');
  fg.setAttribute('cy', '66');
  fg.setAttribute('r', '58');
  fg.setAttribute('fill', 'none');
  const score = a.score ?? 0;
  const medalColor = score >= 96 ? 'var(--gold)' : score >= 90 ? 'var(--silver)' : score >= 80 ? 'var(--bronze)' : 'var(--accent)';
  fg.setAttribute('stroke', medalColor);
  fg.setAttribute('stroke-width', '8');
  fg.setAttribute('stroke-linecap', 'round');
  const C = 2 * Math.PI * 58;
  fg.setAttribute('stroke-dasharray', String(C));
  fg.setAttribute('stroke-dashoffset', String(C));
  fg.setAttribute('transform', 'rotate(-90 66 66)');
  const txt = document.createElementNS(NS, 'text');
  txt.setAttribute('x', '66');
  txt.setAttribute('y', '80');
  txt.setAttribute('text-anchor', 'middle');
  txt.textContent = '0';
  svg.append(bgc, fg, txt);
  arc.appendChild(svg);
  const info = el('div');
  const headline = el('div', { class: 'headline' }, r.failed ? 'Energy out' : score >= 96 ? 'Gold run' : score >= 90 ? 'Silver run' : score >= 80 ? 'Bronze run' : a.passed ? 'Passed' : 'Keep going');
  const medal = el('span', { class: `medal ${a.medal ? 'medal-' + a.medal : ''}` }, a.medal ?? (a.passed ? 'pass' : 'no medal'));
  const coach = el('div', { class: 'coach' }, coachLine(a));
  const pb = el('div', { class: 'coach' }, `${r.isPb ? 'New personal best' : r.prevBest != null ? `Best ${r.prevBest}%` : 'First attempt'} · +${r.xp} XP${r.leveledUp ? ` · Level ${r.level}` : ''} · ${r.streakLine}`);
  info.append(headline, medal, coach, pb);
  top.append(arc, info);
  const rows = el('div', { class: 'rows' });
  const rowDefs: [string, string, string][] = [
    ['Perfect', String(a.tiers.perfect), 'var(--perfect)'],
    ['Great', String(a.tiers.great), 'var(--great)'],
    ['OK', String(a.tiers.ok), 'var(--ok)'],
    ['Miss', String(a.tiers.miss), 'var(--miss)'],
    ['Avg offset', a.timingMeanMs == null ? '—' : `${a.timingMeanMs} ms`, 'var(--ink)'],
    ['Tracking', a.subScores.tracking == null ? '—' : `${a.subScores.tracking}%`, 'var(--ink)'],
  ];
  if (a.perf) rowDefs.push(['Points', a.perf.points.toLocaleString(), 'var(--amber)'], ['Max combo', String(a.perf.maxCombo), 'var(--ink)']);
  if (a.notes) rowDefs.splice(0, 4, ['Correct', String(a.notes.correct), 'var(--perfect)'], ['Wrong', String(a.notes.wrong), 'var(--miss)'], ['Missed', String(a.notes.missed), 'var(--ok)']);
  rowDefs.forEach(([label, value, color], i) => {
    const d = el('div', { style: `animation-delay:${r.reduced ? 0 : 1800 + i * 120}ms` });
    d.appendChild(el('b', { style: `color:${color}` }, value));
    d.appendChild(el('span', {}, label));
    rows.appendChild(d);
  });
  const stars = el('div', { class: 'stars' });
  const starCount = a.perf ? a.perf.stars : score >= 96 ? 3 : score >= 90 ? 2 : score >= 80 ? 1 : 0;
  for (let i = 0; i < 3; i++) stars.appendChild(el('i'));
  const actions = el('div', { class: 'actions' });
  const again = el('button', { class: 'primary' }, 'Again');
  again.onclick = r.onAgain;
  const slower = el('button', {}, 'Slow it down');
  slower.onclick = r.onSlower;
  const next = el('button', {}, 'Next drill');
  next.onclick = r.onNext;
  const hist = el('button', { class: 'ghost' }, 'History');
  hist.onclick = r.onHistory;
  actions.append(again, slower, next, hist);
  sheet.append(top, rows, stars, actions);
  host.appendChild(sheet);
  host.classList.add('open');
  again.focus();
  // choreography
  const start = performance.now();
  const dur = r.reduced ? 1 : 1150;
  const delay = r.reduced ? 0 : 450;
  let lastTick = -1;
  const step = () => {
    if (!sheet.isConnected) return;
    const t = performance.now() - start;
    const k = Math.max(0, Math.min(1, (t - delay) / dur));
    const e = 1 - Math.pow(1 - k, 5);
    const v = Math.round(score * e);
    txt.textContent = String(v);
    fg.setAttribute('stroke-dashoffset', String(C * (1 - (score / 100) * e)));
    const tickIdx = Math.floor(k * 14);
    if (tickIdx !== lastTick && k > 0 && k < 1) {
      lastTick = tickIdx;
      r.sfx.scoreTick(k);
    }
    if (k < 1) requestAnimationFrame(step);
    else {
      txt.textContent = a.score == null ? '—' : String(score);
      const stampAt = r.reduced ? 0 : 150;
      setTimeout(() => {
        if (!sheet.isConnected) return;
        medal.classList.add('stamp');
        if (a.medal) r.sfx.play(a.medal === 'gold' ? 'medalGold' : a.medal === 'silver' ? 'medalSilver' : 'medalBronze');
        else r.sfx.play('thunk', { gain: 0.6 });
        stars.querySelectorAll('i').forEach((s, i) => {
          if (i < starCount) setTimeout(() => sheet.isConnected && s.classList.add('lit'), r.reduced ? 0 : 900 + i * 150);
        });
      }, stampAt);
    }
  };
  requestAnimationFrame(step);
}

export function hideResults(host: HTMLElement): void {
  host.classList.remove('open');
  host.innerHTML = '';
}
