import type { JogState, TargetState } from './state';

/** Accumulate a relative encoder delta on control `c` into the active jog segment. */
export function judgeJogDelta(states: TargetState[], c: string, delta: number, pos: number): void {
  for (const s of states) {
    if (s.kind !== 'jog' || s.c !== c || s.done) continue;
    if (pos < s.t || pos > s.t1) continue;
    const segBeats = (s.t1 - s.t) / s.pattern.length;
    const seg = Math.min(s.pattern.length - 1, Math.floor((pos - s.t) / segBeats));
    s.acc[seg] = (s.acc[seg] ?? 0) + delta;
  }
}

/** Fraction of segments whose net movement matched the pattern direction with enough ticks. */
export function jogCorrectFraction(s: Pick<JogState, 'pattern' | 'acc' | 'minTicks'>): number {
  let ok = 0;
  s.pattern.forEach((dir, i) => {
    const a = s.acc[i] ?? 0;
    if (Math.abs(a) >= s.minTicks && Math.sign(a) === (dir === 'f' ? 1 : -1)) ok++;
  });
  return ok / s.pattern.length;
}

export function finishJogs(states: TargetState[], pos: number): number[] {
  const finished: number[] = [];
  for (const s of states) {
    if (s.kind !== 'jog' || s.done) continue;
    if (pos > s.t1) {
      s.done = true;
      s.correct = jogCorrectFraction(s);
      s.hit = s.correct >= 0.75;
      s.miss = !s.hit;
      finished.push(s.id);
    }
  }
  return finished;
}
