import type { Drill, ScoringThresholds } from '../drills/schema';
import { lanesFor, lengthBeats } from '../drills/lanes';
import { Transport } from '../clock/transport';
import { BeatTicker } from '../clock/metronome';
import { statesFor, resetState, type TargetState, type TapState } from '../scoring/judges/state';
import { judgeTap, expireTaps } from '../scoring/judges/tap';
import { sampleRamps, finishRamps } from '../scoring/judges/ramp';
import { computeStats, type RunStats } from '../scoring/score';
import { medalFor, passed } from '../scoring/medals';
import type { AttemptRecord, InputEvent } from '../scoring/attempt';
import { perTargetOf } from '../scoring/attempt';
import type { Tier } from '../scoring/tiers';

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
}

export type RunPhase = 'idle' | 'countin' | 'running' | 'finished';

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
  /** Integer beats crossed this tick (for the metronome). */
  beats: number[];
  missed: number[];
  finished: number[];
  ended: boolean;
  looped: boolean;
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
  extraPresses = 0;
  phase: RunPhase = 'idle';
  private ticker = new BeatTicker();
  private startedAt = 0;
  private endedAt = 0;
  private opts: RunOptions;

  constructor(drill: Drill, opts: RunOptions) {
    this.drill = drill;
    this.opts = opts;
    this.lanes = lanesFor(drill);
    this.length = lengthBeats(drill);
    this.states = statesFor(drill);
    this.transport = new Transport({ bpm: drill.bpm, beatsPerBar: drill.timeSig?.[0] ?? 4, countInBars: opts.countInBars ?? 0 });
    this.values = { ...(opts.initialValues ?? {}) };
    for (const l of this.lanes) if (this.values[l] === undefined) this.values[l] = 0;
  }

  get bpm(): number {
    return this.transport.bpm;
  }

  get thresholds(): ScoringThresholds {
    return this.opts.thresholds;
  }

  pos(now: number): number {
    return this.transport.pos(now);
  }

  /** Position for an input that arrived at `timeStamp`, with the calibrated offset applied. */
  inputPos(timeStamp: number): number {
    return this.transport.pos(timeStamp - (this.opts.inputOffsetMs ?? 0));
  }

  start(now: number): void {
    this.reset();
    this.transport.start(now);
    this.phase = this.transport.pos(now) < 0 ? 'countin' : 'running';
    this.startedAt = Date.now();
  }

  stop(now: number): void {
    this.transport.stop(now);
    if (this.phase === 'running' || this.phase === 'countin') this.phase = 'idle';
  }

  reset(): void {
    for (const s of this.states) resetState(s);
    this.ticker.reset();
    this.extraPresses = 0;
    this.inputLog.length = 0;
    for (const k of Object.keys(this.flashes)) delete this.flashes[k];
    this.phase = 'idle';
    this.transport.stop(0);
    this.transport.seek(-(this.opts.countInBars ?? 0) * this.transport.beatsPerBar, 0);
  }

  setBpm(bpm: number, now: number): void {
    this.transport.setBpm(bpm, now);
  }

  get active(): boolean {
    return this.phase === 'running' || this.phase === 'countin';
  }

  /** A press on control `c` at `timeStamp` (ms, same clock as `tick`). */
  onTap(c: string, timeStamp: number): { target: TapState | null; extra: boolean } {
    const pos = this.inputPos(timeStamp);
    this.inputLog.push({ t: pos, c, v: 1 });
    if (!this.active) {
      this.flash(c, 'ok', null, null, timeStamp);
      return { target: null, extra: false };
    }
    const j = judgeTap(this.states, c, pos, this.bpm, this.thresholds, this.opts.strictness ?? 1);
    if (j.target) {
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
    this.inputLog.push({ t: this.inputPos(timeStamp), c, v });
  }

  private flash(c: string, kind: 'ok' | 'bad', tier: Tier | null, errMs: number | null, now: number): void {
    this.flashes[c] = { kind, tier, errMs, until: now + 220 };
  }

  /** Advance judges to `now`. Call once per frame while active. */
  tick(now: number): TickResult {
    const result: TickResult = { beats: [], missed: [], finished: [], ended: false, looped: false };
    if (!this.active) return result;
    const pos = this.transport.pos(now);
    if (this.phase === 'countin' && pos >= 0) this.phase = 'running';
    result.missed = expireTaps(this.states, pos, this.thresholds);
    sampleRamps(this.states, pos, this.values);
    result.finished = finishRamps(this.states, pos, this.thresholds);
    result.beats = this.ticker.crossed(pos);
    for (const k of Object.keys(this.flashes)) if (this.flashes[k]!.until < now) delete this.flashes[k];
    if (pos >= this.length + (this.opts.tailBeats ?? 2)) {
      if (this.opts.loop) {
        for (const s of this.states) resetState(s);
        this.ticker.reset();
        this.extraPresses = 0;
        this.transport.seek(0, now);
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
    for (const s of this.states) {
      if (s.kind === 'note' || s.hit || s.miss) continue;
      if (s.kind === 'ramp' && s.done) continue;
      if (s.t < pos - 0.1) continue;
      if (!next || s.t < next.t) next = s;
    }
    if (!next || next.t - pos >= horizon) return null;
    const name = names[next.c] ?? next.c;
    const beats = Math.max(0, Math.ceil(next.t - pos));
    const text =
      next.kind === 'tap'
        ? `Tap ${name} in ${beats} beats`
        : `Move ${name} → ${Math.round(next.v1 * 100)}% in ${beats} beats`;
    return { text, beatsAway: beats };
  }

  stats(): RunStats {
    return computeStats(this.states, this.thresholds);
  }

  /** Build the attempt record; valid once `phase === 'finished'` (or on early stop). */
  attempt(profile: string): AttemptRecord {
    const st = this.stats();
    const passScore = this.drill.passScore;
    return {
      drillId: this.drill.id,
      profile,
      startedAt: this.startedAt,
      endedAt: this.endedAt || Date.now(),
      bpm: this.bpm,
      score: st.score,
      passed: passed(st.score, passScore),
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
    };
  }
}
