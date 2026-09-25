import { LOOP_BARS, STEM_NAMES, sectionAt, type StemName, type TrackSpec } from './patterns';
import type { StemBuffers } from './synth';

/**
 * One deck: looped stem sources, section automation, tempo (playbackRate), nudge, brake and
 * backspin, hot cues, a 4-beat loop, and the channel strip (trim, 3-band EQ, CFX filter,
 * fader). Position is tracked as beats from a rate/time anchor, like the trainer transport.
 */
export interface DeckState {
  playing: boolean;
  beat: number;
  bar: number;
  bpm: number;
  rate: number;
  section: string | null;
  loop: { start: number; beats: number } | null;
}

const ZONE = 0.5;

export class Deck {
  readonly input: GainNode;
  readonly trim: GainNode;
  readonly low: BiquadFilterNode;
  readonly mid: BiquadFilterNode;
  readonly high: BiquadFilterNode;
  readonly lpf: BiquadFilterNode;
  readonly hpf: BiquadFilterNode;
  readonly fader: GainNode;
  readonly output: GainNode;
  readonly stemGains: Record<StemName, GainNode>;
  spec: TrackSpec | null = null;
  private buffers: StemBuffers | null = null;
  private sources: Partial<Record<StemName, AudioBufferSourceNode>> = {};
  private anchorTime = 0;
  private anchorBeat = 0;
  private rate = 1;
  private playing = false;
  private pausedBeat = 0;
  private nudgeTimer: number | null = null;
  private sectionTimer: number | null = null;
  private loop: { start: number; beats: number } | null = null;
  /** Manual stem mutes (stems view / drum swap). */
  stemMute: Record<StemName, boolean> = { kick: false, clap: false, hat: false, bass: false, pad: false, riser: false };
  hotCues: number[] = [0, 64, 128, 192];

  constructor(
    readonly ctx: AudioContext,
    readonly name: 'A' | 'B',
  ) {
    this.input = ctx.createGain();
    this.stemGains = Object.fromEntries(STEM_NAMES.map((s) => [s, ctx.createGain()])) as Record<StemName, GainNode>;
    for (const g of Object.values(this.stemGains)) g.connect(this.input);
    this.trim = ctx.createGain();
    this.low = ctx.createBiquadFilter();
    this.low.type = 'lowshelf';
    this.low.frequency.value = 220;
    this.mid = ctx.createBiquadFilter();
    this.mid.type = 'peaking';
    this.mid.frequency.value = 1000;
    this.mid.Q.value = 0.8;
    this.high = ctx.createBiquadFilter();
    this.high.type = 'highshelf';
    this.high.frequency.value = 5000;
    this.lpf = ctx.createBiquadFilter();
    this.lpf.type = 'lowpass';
    this.lpf.frequency.value = 20000;
    this.hpf = ctx.createBiquadFilter();
    this.hpf.type = 'highpass';
    this.hpf.frequency.value = 10;
    this.fader = ctx.createGain();
    this.fader.gain.value = 0;
    this.output = ctx.createGain();
    this.input.connect(this.trim).connect(this.low).connect(this.mid).connect(this.high).connect(this.lpf).connect(this.hpf).connect(this.fader).connect(this.output);
  }

  get loaded(): boolean {
    return !!this.buffers;
  }

  load(spec: TrackSpec, buffers: StemBuffers): void {
    this.stop();
    this.spec = spec;
    this.buffers = buffers;
    this.pausedBeat = 0;
    this.rate = 1;
    this.hotCues = [0, 16 * 4, 32 * 4, 48 * 4].map((b) => Math.min(b, spec.bars * 4 - 4));
    this.applySection(0);
  }

  /** Beats since the start of the track at ctx time `t`. */
  beatAt(t = this.ctx.currentTime): number {
    if (!this.playing) return this.pausedBeat;
    return this.anchorBeat + ((t - this.anchorTime) * this.spec!.bpm * this.rate) / 60;
  }

  get bpm(): number {
    return this.spec ? Math.round(this.spec.bpm * this.rate * 100) / 100 : 0;
  }

  state(): DeckState {
    const beat = this.beatAt();
    const bar = Math.floor(beat / 4);
    return { playing: this.playing, beat, bar, bpm: this.bpm, rate: this.rate, section: this.spec ? (sectionAt(this.spec, bar)?.kind ?? null) : null, loop: this.loop };
  }

  play(fromBeat = this.pausedBeat): void {
    if (!this.buffers || !this.spec || this.playing) return;
    const now = this.ctx.currentTime + 0.02;
    const loopSec = (60 / this.spec.bpm) * 4 * LOOP_BARS;
    const offset = ((fromBeat * 60) / this.spec.bpm) % loopSec;
    for (const s of STEM_NAMES) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers[s];
      src.loop = true;
      src.playbackRate.value = this.rate;
      src.connect(this.stemGains[s]);
      src.start(now, offset);
      this.sources[s] = src;
    }
    this.anchorTime = now;
    this.anchorBeat = fromBeat;
    this.playing = true;
    this.scheduleSections();
  }

  pause(): void {
    if (!this.playing) return;
    this.pausedBeat = this.beatAt();
    this.stopSources();
    this.playing = false;
    if (this.sectionTimer) clearInterval(this.sectionTimer);
  }

  stop(): void {
    this.pause();
    this.pausedBeat = 0;
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  /** Jump to a beat (hot cue, seek). */
  seek(beat: number): void {
    const was = this.playing;
    if (was) this.pause();
    this.pausedBeat = Math.max(0, beat);
    if (was) this.play(this.pausedBeat);
  }

  cue(index: number): void {
    const b = this.hotCues[index];
    if (b != null) this.seek(b);
  }

  /** Set tempo as a rate multiplier (1 = original). */
  setRate(rate: number): void {
    const now = this.ctx.currentTime;
    if (this.playing) {
      this.anchorBeat = this.beatAt(now);
      this.anchorTime = now;
    }
    this.rate = rate;
    for (const src of Object.values(this.sources)) src?.playbackRate.setValueAtTime(rate, now);
  }

  /** Tempo fader 0..1 mapped to ±range (default ±8 %). */
  setTempoFader(v: number, range = 0.08): void {
    this.setRate(1 + (v - 0.5) * 2 * range);
  }

  /** Brief pitch bend: forward (+) or back (−) for `ms`. */
  nudge(dir: 1 | -1, amount = 0.03, ms = 150): void {
    if (!this.playing) return;
    const base = this.rate;
    this.setRate(base * (1 + dir * amount));
    if (this.nudgeTimer) clearTimeout(this.nudgeTimer);
    this.nudgeTimer = window.setTimeout(() => this.setRate(base), ms);
  }

  /** Relative jog ticks while playing: pitch bend proportional to ticks. */
  jog(delta: number): void {
    this.nudge(delta > 0 ? 1 : -1, Math.min(0.08, Math.abs(delta) * 0.01), 120);
  }

  /** Brake: rate ramps to 0 over `sec`, then pause. */
  brake(sec = 0.6): void {
    if (!this.playing) return;
    const now = this.ctx.currentTime;
    for (const src of Object.values(this.sources)) {
      src?.playbackRate.setValueAtTime(this.rate, now);
      src?.playbackRate.linearRampToValueAtTime(0.0001, now + sec);
    }
    const beat = this.beatAt(now);
    window.setTimeout(() => {
      this.stopSources();
      this.playing = false;
      this.pausedBeat = beat;
      if (this.sectionTimer) clearInterval(this.sectionTimer);
    }, sec * 1000);
  }

  /** Backspin: fast reverse-sounding pitch drop then stop. Sources cannot reverse, so this
   *  ramps the rate down hard and seeks back a bar on stop. */
  backspin(sec = 0.5): void {
    if (!this.playing) return;
    const beat = this.beatAt();
    this.brake(sec);
    window.setTimeout(() => (this.pausedBeat = Math.max(0, beat - 4)), sec * 1000 + 10);
  }

  /** 4-beat loop from the current bar; call again to exit. */
  toggleLoop(beats = 4): void {
    if (this.loop) {
      this.loop = null;
      return;
    }
    const start = Math.floor(this.beatAt() / beats) * beats;
    this.loop = { start, beats };
  }

  /** Halve the current loop (loop roll). */
  halveLoop(): void {
    if (!this.loop) return this.toggleLoop(4);
    this.loop = { start: this.loop.start, beats: Math.max(0.25, this.loop.beats / 2) };
  }

  /** Called every frame: keeps the loop and section automation honest. */
  tick(): void {
    if (!this.playing || !this.spec) return;
    if (this.loop) {
      const b = this.beatAt();
      if (b >= this.loop.start + this.loop.beats) this.seek(this.loop.start);
    }
  }

  /** Channel strip values 0..1 as the FLX4 sends them. */
  setTrim(v: number): void {
    this.trim.gain.setTargetAtTime(Math.pow(2, (v - 0.5) * 4), this.ctx.currentTime, 0.01);
  }

  setEq(band: 'low' | 'mid' | 'high', v: number): void {
    const db = v <= 0.5 ? -26 * (1 - v * 2) : 6 * (v - 0.5) * 2;
    this[band].gain.setTargetAtTime(db, this.ctx.currentTime, 0.01);
  }

  /** CFX: left of centre low-pass (20 kHz → 200 Hz), right high-pass (10 Hz → 8 kHz). */
  setFilter(v: number): void {
    const now = this.ctx.currentTime;
    if (v < 0.5) {
      const k = 1 - v / 0.5;
      this.lpf.frequency.setTargetAtTime(20000 * Math.pow(200 / 20000, k), now, 0.01);
      this.hpf.frequency.setTargetAtTime(10, now, 0.01);
    } else {
      const k = (v - 0.5) / 0.5;
      this.hpf.frequency.setTargetAtTime(10 * Math.pow(8000 / 10, k), now, 0.01);
      this.lpf.frequency.setTargetAtTime(20000, now, 0.01);
    }
  }

  setFader(v: number): void {
    this.fader.gain.setTargetAtTime(v * v, this.ctx.currentTime, 0.005);
  }

  setStemMute(stem: StemName, mute: boolean): void {
    this.stemMute[stem] = mute;
    this.applySection(Math.floor(this.beatAt() / 4));
  }

  private applySection(bar: number): void {
    if (!this.spec) return;
    const sec = sectionAt(this.spec, bar);
    const now = this.ctx.currentTime;
    for (const s of STEM_NAMES) {
      const target = sec && !this.stemMute[s] ? sec.stems[s] : 0;
      this.stemGains[s].gain.setTargetAtTime(target, now, 0.05);
    }
  }

  private scheduleSections(): void {
    if (this.sectionTimer) clearInterval(this.sectionTimer);
    let lastBar = -1;
    this.sectionTimer = window.setInterval(() => {
      if (!this.playing) return;
      const bar = Math.floor(this.beatAt() / 4);
      if (bar !== lastBar) {
        lastBar = bar;
        this.applySection(bar);
        if (this.spec && bar >= this.spec.bars) this.stop();
      }
    }, 40);
  }

  private stopSources(): void {
    for (const src of Object.values(this.sources)) {
      try {
        src?.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources = {};
  }

  /** Signed phase error to another deck in beats, normalised to ±0.5. */
  phaseTo(other: Deck): number {
    let d = (this.beatAt() - other.beatAt()) % 1;
    if (d > ZONE) d -= 1;
    if (d < -ZONE) d += 1;
    return d;
  }
}
