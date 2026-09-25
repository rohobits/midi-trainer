import type { Drill, ScoringThresholds } from '../drills/schema';
import { lanesFor, lengthBeats } from '../drills/lanes';
import type { ControlKindMap } from '../drills/expand';
import { Transport } from '../clock/transport';
import { BeatTicker } from '../clock/metronome';
import { statesFor, resetState, stateSettled, type TargetState, type TapState, type CutState, type SelectState } from '../scoring/judges/state';
import { judgeTap, expireTaps } from '../scoring/judges/tap';
import { sampleRamps, finishRamps } from '../scoring/judges/ramp';
import { judgeCutValue, expireCuts } from '../scoring/judges/cut';
import { sampleCrosses, finishCrosses } from '../scoring/judges/cross';
import { judgeJogDelta, finishJogs } from '../scoring/judges/jog';
import { judgeSelectPress, expireSelects } from '../scoring/judges/select';
import { computeStats, targetScore, type RunStats } from '../scoring/score';
import { medalFor, passed } from '../scoring/medals';
import type { AttemptRecord, InputEvent } from '../scoring/attempt';
import { perTargetOf } from '../scoring/attempt';
import type { Tier } from '../scoring/tiers';
import { PerfState } from './perf';

export interface RunOptions {
  thresholds: ScoringThresholds;
  strictness?: number;
  /** Calibrated input offset in ms; subtracted from event timestamps. */
  inputOffsetMs?: number;
  countInBars?: number;
  loop?: boolean;
  /** Extra beats after the last bar before the run ends (prototype: 2). */
  tailBeats?: number;
  initialValues?: Record<string, number>;
  /** Control kinds for expanding compound targets. */
  kinds?: ControlKindMap;
  /** Tempo multiplier on the drill BPM (0.5..1.1). Default 1. */
  tempoScale?: number;
  /** Section loop in bars, 1-based inclusive. Loops that range instead of the whole drill. */
  section?: [number, number] | null;
  /** Freeze the clock at each press target until it is pressed. */
  waitMode?: boolean;
  /** 'lesson' = no-fail; 'performance' = multiplier, Euphoria, energy. */
  mode?: 'lesson' | 'performance';
  /** Only judge targets on these lanes (deck/mixer isolation). Others are skipped as done. */
  onlyLanes?: readonly string[] | null;
}

export type RunPhase = 'idle' | 'countin' | 'running' | 'finished' | 'failed';

export interface Flash {
  kind: 'ok' | 'bad';
  tier: Tier | null;
  errMs: number | null;
  until: number;
}

export interface CueText {
  text: string;
  beatsAway: number;
}

export interface TickResult {
  beats: number[];
  missed: number[];
  finished: number[];
  ended: boolean;
  looped: boolean;
  /** Wait mode: the clock is frozen on a press target. */
  waiting: boolean;
}

/**
 * One drill attempt for control-based (DJ) drills: owns the transport, target states and
 * judges. The app feeds it MIDI events and calls `tick` once per frame.
 */
export class DrillRun {
  readonly drill: Drill;
  readonly lanes: string[];
  readonly length: number;
  readonly states: TargetState[];
  readonly transport: Transport;
  readonly values: Record<string, number>;
  readonly flashes: Record<string, Flash> = {};
  readonly inputLog: InputEvent[] = [];
  readonly perf: PerfState | null;
  extraPresses = 0;
  phase: RunPhase = 'idle';
  waiting = false;
  private ticker = new BeatTicker();
  private startedAt = 0;
  private endedAt = 0;
  private opts: RunOptions;
  private settledIds = new Set<number>();
  private sectionStart: number;
  private sectionEnd: number;

  constructor(drill: Drill, opts: RunOptions) {
    this.drill = drill;
    this.opts = opts;
    this.lanes = lanesFor(drill);
    this.length = lengthBeats(drill);
    this.states = statesFor(drill, opts.kinds);
    const bpb = drill.timeSig?.[0] ?? 4;
    this.transport = new Transport({ bpm: drill.bpm * (opts.tempoScale ?? 1), beatsPerBar: bpb, countInBars: opts.countInBars ?? 0 });
    this.values = { ...(opts.initialValues ?? {}) };
    for (const l of this.lanes) if (this.values[l] === undefined) this.values[l] = 0;
    this.perf = opts.mode === 'performance' ? new PerfState({ phraseBeats: 8 * bpb, strict: false }) : null;
    const sec = opts.section;
    this.sectionStart = sec ? (sec[0] - 1) * bpb : 0;
    this.sectionEnd = sec ? sec[1] * bpb : this.length + (opts.tailBeats ?? 2);
    this.skipOtherLanes();
    this.transport.seek(this.sectionStart - (opts.countInBars ?? 0) * bpb, 0);
  }

  get bpm(): number {
    return this.transport.bpm;
  }

  get thresholds(): ScoringThresholds {
    return this.opts.thresholds;
  }

  get mode(): 'lesson' | 'performance' {
    return this.opts.mode ?? 'lesson';
  }

  pos(now: number): number {
    return this.transport.pos(now);
  }

  /** Position for an input that arrived at `timeStamp`, with the calibrated offset applied. */
  inputPos(timeStamp: number): number {
    return this.transport.pos(timeStamp - (this.opts.inputOffsetMs ?? 0));
  }

  private skipOtherLanes(): void {
    const only = this.opts.onlyLanes;
    if (!only) return;
    const set = new Set(only);
    for (const s of this.states) {
      if (s.kind === 'note') continue;
      const on = s.kind === 'cross' ? set.has(s.c) || set.has(s.c2) : set.has(s.c);
      if (!on) {
        // Treated as already settled and excluded from stats via settledIds without scoring.
        this.settledIds.add(s.id);
        if (s.kind === 'ramp' || s.kind === 'cross' || s.kind === 'jog') s.done = true;
        s.hit = true;
        s.miss = false;
      }
    }
  }

  private judgedStates(): TargetState[] {
    const only = this.opts.onlyLanes;
    if (!only) return this.states;
    const set = new Set(only);
    return this.states.filter((s) => s.kind !== 'note' && (s.kind === 'cross' ? set.has(s.c) || set.has(s.c2) : set.has(s.c)));
  }

  start(now: number): void {
    this.reset();
    const bpb = this.transport.beatsPerBar;
    this.transport.start(now, this.sectionStart - (this.opts.countInBars ?? 0) * bpb);
    this.phase = this.transport.pos(now) < this.sectionStart ? 'countin' : 'running';
    this.startedAt = Date.now();
  }

  stop(now: number): void {
    this.transport.stop(now);
    if (this.phase === 'running' || this.phase === 'countin') this.phase = 'idle';
  }

  reset(): void {
    for (const s of this.states) resetState(s);
    this.settledIds.clear();
    this.skipOtherLanes();
    this.ticker.reset();
    this.extraPresses = 0;
    this.inputLog.length = 0;
    this.perf?.reset();
    this.waiting = false;
    for (const k of Object.keys(this.flashes)) delete this.flashes[k];
    this.phase = 'idle';
    this.transport.stop(0);
    this.transport.seek(this.sectionStart - (this.opts.countInBars ?? 0) * this.transport.beatsPerBar, 0);
  }

  setBpm(bpm: number, now: number): void {
    this.transport.setBpm(bpm, now);
  }

  get active(): boolean {
    return this.phase === 'running' || this.phase === 'countin';
  }

  /** Wait mode: the earliest unsettled press target (tap/cut). */
  private nextPress(_pos: number): TapState | CutState | null {
    let best: TapState | CutState | null = null;
    for (const s of this.judgedStates()) {
      if ((s.kind !== 'tap' && s.kind !== 'cut') || stateSettled(s)) continue;
      if (!best || s.t < best.t) best = s;
    }
    return best;
  }

  /** A press on control `c` at `timeStamp` (ms, same clock as `tick`). */
  onTap(c: string, timeStamp: number): { target: TapState | SelectState | null; extra: boolean } {
    const pos = this.inputPos(timeStamp);
    this.inputLog.push({ t: pos, c, v: 1 });
    if (!this.active) {
      this.flash(c, 'ok', null, null, timeStamp);
      return { target: null, extra: false };
    }
    const states = this.judgedStates();
    if (this.waiting) {
      const next = this.nextPress(this.transport.pos(timeStamp));
      if (next && next.kind === 'tap' && next.c === c) {
        next.hit = true;
        next.errMs = 0;
        next.tier = 'perfect';
        next.hitAt = next.t;
        this.waiting = false;
        this.transport.resume(timeStamp);
        this.afterSettle(next, next.t);
        this.flash(c, 'ok', 'perfect', 0, timeStamp);
        return { target: next, extra: false };
      }
    }
    const sel = judgeSelectPress(states, c, pos);
    if (sel) {
      this.afterSettle(sel, pos);
      this.flash(c, sel.hit ? 'ok' : 'bad', null, null, timeStamp);
      return { target: sel, extra: false };
    }
    const j = judgeTap(states, c, pos, this.bpm, this.thresholds, this.opts.strictness ?? 1);
    if (j.target) {
      this.afterSettle(j.target, pos);
      this.flash(c, 'ok', j.target.tier, j.target.errMs, timeStamp);
      return { target: j.target, extra: false };
    }
    this.extraPresses++;
    this.flash(c, 'bad', null, null, timeStamp);
    return { target: null, extra: true };
  }

  /** A continuous control moved. */
  onValue(c: string, v: number, timeStamp: number): void {
    this.values[c] = v;
    const pos = this.inputPos(timeStamp);
    this.inputLog.push({ t: pos, c, v });
    if (!this.active) return;
    const landed = judgeCutValue(this.judgedStates(), c, v, pos, timeStamp, this.bpm, this.thresholds, this.opts.strictness ?? 1);
    if (landed) {
      this.afterSettle(landed, pos);
      this.flash(c, 'ok', landed.tier, landed.errMs, timeStamp);
    }
  }

  /** A relative encoder (jog) moved by `delta` ticks. */
  onRel(c: string, delta: number, timeStamp: number): void {
    const pos = this.inputPos(timeStamp);
    this.inputLog.push({ t: pos, c, v: delta });
    if (!this.active) return;
    judgeJogDelta(this.judgedStates(), c, delta, pos);
  }

  /** Performance mode: spend a Euphoria charge. */
  activateEuphoria(now: number): boolean {
    return this.perf?.activateEuphoria(this.pos(now)) ?? false;
  }

  private afterSettle(s: TargetState, pos: number): void {
    if (this.settledIds.has(s.id)) return;
    this.settledIds.add(s.id);
    if (this.perf) {
      const sc = targetScore(s, this.thresholds) ?? 0;
      this.perf.settle(sc, pos);
      if (this.perf.failed) this.phase = 'failed';
    }
  }

  private flash(c: string, kind: 'ok' | 'bad', tier: Tier | null, errMs: number | null, now: number): void {
    this.flashes[c] = { kind, tier, errMs, until: now + 220 };
  }

  /** Advance judges to `now`. Call once per frame while active. */
  tick(now: number): TickResult {
    const result: TickResult = { beats: [], missed: [], finished: [], ended: false, looped: false, waiting: this.waiting };
    if (!this.active) return result;
    let pos = this.transport.pos(now);
    if (this.phase === 'countin' && pos >= this.sectionStart) this.phase = 'running';
    const states = this.judgedStates();
    if (this.opts.waitMode && this.phase === 'running' && !this.waiting) {
      const next = this.nextPress(pos);
      if (next && next.kind === 'tap' && pos >= next.t) {
        this.transport.freeze(next.t);
        pos = next.t;
        this.waiting = true;
      }
    }
    result.waiting = this.waiting;
    const t = this.thresholds;
    result.missed = [...expireTaps(states, pos, t), ...expireCuts(states, pos, t), ...expireSelects(states, pos)];
    sampleRamps(states, pos, this.values);
    sampleCrosses(states, pos, this.values);
    result.finished = [...finishRamps(states, pos, t), ...finishCrosses(states, pos, t), ...finishJogs(states, pos)];
    for (const id of [...result.missed, ...result.finished]) {
      const s = this.states[id];
      if (s) this.afterSettle(s, pos);
    }
    this.perf?.tick(pos);
    result.beats = this.ticker.crossed(pos);
    for (const k of Object.keys(this.flashes)) if (this.flashes[k]!.until < now) delete this.flashes[k];
    if (this.phase === 'failed') {
      this.transport.stop(now);
      this.endedAt = Date.now();
      result.ended = true;
      return result;
    }
    if (pos >= this.sectionEnd) {
      if (this.opts.loop || this.opts.section) {
        for (const s of this.states) resetState(s);
        this.settledIds.clear();
        this.skipOtherLanes();
        this.ticker.reset();
        this.extraPresses = 0;
        this.perf?.reset();
        this.transport.seek(this.sectionStart, now);
        result.looped = true;
      } else {
        this.transport.stop(now);
        this.phase = 'finished';
        this.endedAt = Date.now();
        result.ended = true;
      }
    }
    return result;
  }

  /** Next pending target for the on-screen cue, within `horizon` beats. */
  cue(pos: number, names: Readonly<Record<string, string>>, horizon = 4): CueText | null {
    let next: TargetState | null = null;
    for (const s of this.judgedStates()) {
      if (s.kind === 'note' || stateSettled(s)) continue;
      if (s.t < pos - 0.1) continue;
      if (!next || s.t < next.t) next = s;
    }
    if (!next || next.t - pos >= horizon) return null;
    const name = (c: string) => names[c] ?? c;
    const beats = Math.max(0, Math.ceil(next.t - pos));
    let text: string;
    switch (next.kind) {
      case 'tap':
        text = `Tap ${name(next.c)}`;
        break;
      case 'ramp':
        text = `${next.source === 'hold' ? 'Hold' : 'Move'} ${name(next.c)} → ${Math.round(next.v1 * 100)}%`;
        break;
      case 'cut':
        text = `Cut ${name(next.c)} → ${Math.round(next.v1 * 100)}%`;
        break;
      case 'cross':
        text = `Swap ${name(next.c)} ↔ ${name(next.c2)}`;
        break;
      case 'jog':
        text = `Jog ${name(next.c)} ${next.pattern.map((p) => (p === 'f' ? '→' : '←')).join('')}`;
        break;
      case 'select':
        text = `Choose ${name(next.c)}`;
        break;
      default:
        text = '';
    }
    return { text: `${text} in ${beats} beats`, beatsAway: beats };
  }

  stats(): RunStats {
    const only = this.opts.onlyLanes;
    return computeStats(only ? this.judgedStates() : this.states, this.thresholds);
  }

  /** Build the attempt record; valid once the run finished (or on early stop). */
  attempt(profile: string): AttemptRecord {
    const st = this.stats();
    const p = this.perf?.snapshot();
    return {
      drillId: this.drill.id,
      profile,
      startedAt: this.startedAt,
      endedAt: this.endedAt || Date.now(),
      bpm: this.bpm,
      score: st.score,
      passed: passed(st.score, this.drill.passScore),
      medal: medalFor(st.score),
      timingMeanMs: st.timingMeanMs,
      timingSdMs: st.timingSdMs,
      trackingMean: st.trackingMean,
      tiers: st.tiers,
      subScores: st.sub,
      extraPresses: this.extraPresses,
      inputOffsetMs: this.opts.inputOffsetMs ?? 0,
      strictness: this.opts.strictness ?? 1,
      perTarget: perTargetOf(this.states),
      inputLog: [...this.inputLog],
      mode: this.mode,
      tempoScale: this.opts.tempoScale ?? 1,
      ...(p ? { perf: { points: p.points, maxCombo: p.maxCombo, stars: p.stars } } : {}),
    };
  }
}
