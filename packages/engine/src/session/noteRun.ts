import type { Drill, ScoringThresholds } from '../drills/schema';
import { Transport } from '../clock/transport';
import { BeatTicker } from '../clock/metronome';
import { statesFor, resetState, type NoteState, type TargetState } from '../scoring/judges/state';
import { dueGroup, nextUnhit, judgeNoteOn, expireNotes, expectedNotes, noteAccuracy, type Hand, type NoteMode } from '../scoring/judges/note';
import { medalFor, passed } from '../scoring/medals';
import type { AttemptRecord, InputEvent } from '../scoring/attempt';
import { perTargetOf } from '../scoring/attempt';
import { emptyTierCounts, type Tier } from '../scoring/tiers';

export interface NoteRunOptions {
  thresholds: ScoringThresholds;
  strictness?: number;
  inputOffsetMs?: number;
  mode: NoteMode;
  hand: Hand;
  loop?: boolean;
  /** 1-based start bar. */
  startBar?: number;
  tempoScale?: number;
  section?: [number, number] | null;
}

export interface NoteFlash {
  kind: 'ok' | 'bad';
  until: number;
}

export interface NoteTickResult {
  beats: number[];
  /** Notes whose start was crossed this tick (guide tones). */
  guide: NoteState[];
  ended: boolean;
  looped: boolean;
  waiting: boolean;
}

/**
 * One piano exercise attempt. Wait mode advances until the next unhit active note, freezes
 * there, and releases once every note in that group is played. Play-along runs freely and
 * marks notes missed after the window (prototype semantics).
 */
export class NoteRun {
  readonly drill: Drill;
  readonly states: TargetState[];
  readonly transport: Transport;
  readonly length: number;
  readonly pressed = new Set<number>();
  readonly flashes: Record<number, NoteFlash> = {};
  readonly inputLog: InputEvent[] = [];
  correct = 0;
  wrong = 0;
  phase: 'idle' | 'running' | 'finished' = 'idle';
  waiting = false;
  private ticker = new BeatTicker();
  private startedAt = 0;
  private endedAt = 0;
  private opts: NoteRunOptions;
  private from: number;
  private end: number;
  private errs: number[] = [];
  private tiers = emptyTierCounts();

  constructor(drill: Drill, opts: NoteRunOptions) {
    this.drill = drill;
    this.opts = opts;
    this.states = statesFor(drill);
    const bpb = drill.timeSig?.[0] ?? 4;
    this.transport = new Transport({ bpm: drill.bpm * (opts.tempoScale ?? 1), beatsPerBar: bpb });
    let last = 0;
    for (const s of this.states) if (s.kind === 'note') last = Math.max(last, s.t + s.d);
    this.length = Math.max(last, 4);
    const sec = opts.section;
    this.from = sec ? (sec[0] - 1) * bpb : ((opts.startBar ?? 1) - 1) * bpb;
    this.end = sec ? sec[1] * bpb : this.length + 1;
    this.transport.seek(this.from, 0);
  }

  get bpm(): number {
    return this.transport.bpm;
  }

  get mode(): NoteMode {
    return this.opts.mode;
  }

  get hand(): Hand {
    return this.opts.hand;
  }

  get bars(): number {
    return Math.ceil(this.length / this.transport.beatsPerBar);
  }

  get active(): boolean {
    return this.phase === 'running';
  }

  pos(now: number): number {
    return this.transport.pos(now);
  }

  start(now: number): void {
    this.reset();
    this.transport.start(now, this.from);
    this.phase = 'running';
    this.startedAt = Date.now();
  }

  /** Pause keeping position (prototype Space toggles pause). */
  pause(now: number): void {
    this.transport.stop(now);
    if (this.phase === 'running') this.phase = 'idle';
    this.waiting = false;
  }

  resume(now: number): void {
    if (this.phase === 'finished') return;
    this.transport.start(now, this.transport.pos(now));
    this.phase = 'running';
  }

  reset(): void {
    for (const s of this.states) resetState(s);
    this.pressed.clear();
    this.correct = 0;
    this.wrong = 0;
    this.errs = [];
    this.tiers = emptyTierCounts();
    this.inputLog.length = 0;
    this.ticker.reset();
    this.waiting = false;
    this.phase = 'idle';
    this.transport.stop(0);
    this.transport.seek(this.from, 0);
  }

  setBpm(bpm: number, now: number): void {
    this.transport.setBpm(bpm, now);
  }

  noteOn(n: number, timeStamp: number): { target: NoteState | null; tier: Tier | null } {
    this.pressed.add(n);
    const pos = this.transport.pos(timeStamp - (this.opts.inputOffsetMs ?? 0));
    this.inputLog.push({ t: pos, c: `note:${n}`, v: 1 });
    if (!this.active) {
      this.flash(n, 'ok', timeStamp);
      return { target: null, tier: null };
    }
    const j = judgeNoteOn(this.states, n, pos, this.bpm, this.opts.mode, this.opts.hand, this.opts.thresholds, this.opts.strictness ?? 1);
    if (j.target) {
      this.correct++;
      if (j.tier) this.tiers[j.tier]++;
      if (j.target.errMs != null) this.errs.push(j.target.errMs);
      this.flash(n, 'ok', timeStamp);
    } else {
      this.wrong++;
      this.flash(n, 'bad', timeStamp);
    }
    return j;
  }

  noteOff(n: number, timeStamp: number): void {
    this.pressed.delete(n);
    this.inputLog.push({ t: this.transport.pos(timeStamp), c: `note:${n}`, v: 0 });
  }

  private flash(n: number, kind: 'ok' | 'bad', now: number): void {
    this.flashes[n] = { kind, until: now + 260 };
  }

  get missed(): number {
    let m = 0;
    for (const s of this.states) if (s.kind === 'note' && s.miss) m++;
    return m;
  }

  tick(now: number): NoteTickResult {
    const result: NoteTickResult = { beats: [], guide: [], ended: false, looped: false, waiting: this.waiting };
    if (!this.active) return result;
    let pos = this.transport.pos(now);
    if (this.opts.mode === 'wait') {
      const next = nextUnhit(this.states, this.transport.isFrozen ? pos : Math.min(pos, this.lastPos), this.opts.hand);
      if (!this.transport.isFrozen && next && pos >= next.t) {
        this.transport.freeze(next.t);
        pos = next.t;
        this.waiting = true;
      }
      if (this.waiting && dueGroup(this.states, pos, this.opts.hand).length === 0) {
        this.waiting = false;
        this.transport.resume(now);
        this.transport.seek(pos + 0.0001, now);
      }
    } else {
      expireNotes(this.states, pos, this.opts.hand, this.opts.thresholds);
    }
    this.lastPos = pos;
    result.waiting = this.waiting;
    result.beats = this.ticker.crossed(pos);
    for (const s of this.states) {
      if (s.kind !== 'note') continue;
      if (!s.guided && s.t <= pos && s.t > pos - 0.2) {
        s.guided = true;
        result.guide.push(s);
      }
      if (s.t > pos + 0.5) s.guided = false;
    }
    for (const k of Object.keys(this.flashes)) if (this.flashes[+k]!.until < now) delete this.flashes[+k];
    if (pos >= this.end) {
      if (this.opts.loop || this.opts.section) {
        for (const s of this.states) resetState(s);
        this.ticker.reset();
        this.transport.seek(this.from, now);
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
  private lastPos = -Infinity;

  /** Keys that should be lit right now. */
  expected(pos: number): NoteState[] {
    return expectedNotes(this.states, pos, this.opts.hand);
  }

  /** Names of the next notes due (for the "Next:" readout). */
  nextDue(pos: number): NoteState[] {
    const next = nextUnhit(this.states, pos, this.opts.hand);
    if (!next) return [];
    return this.states.filter((s): s is NoteState => s.kind === 'note' && !s.hit && s.t === next.t && (this.opts.hand === 'B' || s.hand === this.opts.hand || s.hand === undefined));
  }

  accuracy(): number | null {
    return noteAccuracy(this.correct, this.wrong, this.missed);
  }

  attempt(profile = 'piano88'): AttemptRecord {
    const acc = this.accuracy();
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const bias = this.errs.length ? mean(this.errs) : null;
    return {
      drillId: this.drill.id,
      profile,
      startedAt: this.startedAt,
      endedAt: this.endedAt || Date.now(),
      bpm: this.bpm,
      score: acc,
      passed: passed(acc, this.drill.passScore),
      medal: medalFor(acc),
      timingMeanMs: this.errs.length ? Math.round(mean(this.errs.map(Math.abs))) : null,
      timingSdMs: this.errs.length > 1 && bias != null ? Math.round(Math.sqrt(mean(this.errs.map((e) => (e - bias) ** 2)))) : null,
      trackingMean: null,
      tiers: { ...this.tiers },
      subScores: { timing: acc, tracking: null },
      extraPresses: this.wrong,
      inputOffsetMs: this.opts.inputOffsetMs ?? 0,
      strictness: this.opts.strictness ?? 1,
      perTarget: perTargetOf(this.states),
      inputLog: [...this.inputLog],
      mode: 'lesson',
      tempoScale: this.opts.tempoScale ?? 1,
      notes: { correct: this.correct, wrong: this.wrong, missed: this.missed, mode: this.opts.mode, hand: this.opts.hand },
    };
  }
}
