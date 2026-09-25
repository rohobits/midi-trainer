import { Deck } from './deck';
import { makeTrack, type Genre, type TrackSpec } from './patterns';
import { renderStems, type StemBuffers } from './synth';

/**
 * Two decks into a crossfader, a Beat FX echo send (CH SELECT 1 / 2 / master), a master
 * gain, a "beat focus" low-pass listening aid and an analyser for meters.
 */
export class Mixer {
  readonly ctx: AudioContext;
  readonly a: Deck;
  readonly b: Deck;
  readonly xfA: GainNode;
  readonly xfB: GainNode;
  readonly master: GainNode;
  readonly focus: BiquadFilterNode;
  readonly analyser: AnalyserNode;
  readonly echoSendA: GainNode;
  readonly echoSendB: GainNode;
  readonly echoSendMaster: GainNode;
  readonly delay: DelayNode;
  readonly feedback: GainNode;
  readonly echoWet: GainNode;
  private echoOn = false;
  private echoLevel = 0.5;
  private chSelect: 1 | 2 | 'master' = 1;
  private cache = new Map<string, StemBuffers>();

  constructor(ctx = new AudioContext()) {
    this.ctx = ctx;
    this.a = new Deck(ctx, 'A');
    this.b = new Deck(ctx, 'B');
    this.xfA = ctx.createGain();
    this.xfB = ctx.createGain();
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.focus = ctx.createBiquadFilter();
    this.focus.type = 'lowpass';
    this.focus.frequency.value = 20000;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.a.output.connect(this.xfA).connect(this.master);
    this.b.output.connect(this.xfB).connect(this.master);
    this.delay = ctx.createDelay(2);
    this.feedback = ctx.createGain();
    this.feedback.gain.value = 0.45;
    this.echoWet = ctx.createGain();
    this.echoWet.gain.value = 0;
    this.echoSendA = ctx.createGain();
    this.echoSendB = ctx.createGain();
    this.echoSendMaster = ctx.createGain();
    this.echoSendA.gain.value = 0;
    this.echoSendB.gain.value = 0;
    this.echoSendMaster.gain.value = 0;
    this.a.output.connect(this.echoSendA).connect(this.delay);
    this.b.output.connect(this.echoSendB).connect(this.delay);
    this.master.connect(this.echoSendMaster).connect(this.delay);
    this.delay.connect(this.feedback).connect(this.delay);
    this.delay.connect(this.echoWet).connect(this.focus);
    this.master.connect(this.focus).connect(this.analyser).connect(ctx.destination);
    this.setCrossfader(0.5);
  }

  async ensure(): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  /** Render (cached) and load a synthesized track into a deck. */
  async loadTrack(deck: 'A' | 'B', seed: number, genre: Genre = 'house', bpmOverride?: number): Promise<TrackSpec> {
    const spec = makeTrack(seed, genre);
    if (bpmOverride) spec.bpm = bpmOverride;
    const key = `${spec.id}@${spec.bpm}`;
    let buffers = this.cache.get(key);
    if (!buffers) {
      buffers = await renderStems(spec);
      this.cache.set(key, buffers);
    }
    (deck === 'A' ? this.a : this.b).load(spec, buffers);
    return spec;
  }

  deck(name: 'A' | 'B'): Deck {
    return name === 'A' ? this.a : this.b;
  }

  /** Constant-power crossfader, 0 = A only, 1 = B only. */
  setCrossfader(v: number): void {
    const now = this.ctx.currentTime;
    this.xfA.gain.setTargetAtTime(Math.cos((v * Math.PI) / 2), now, 0.005);
    this.xfB.gain.setTargetAtTime(Math.sin((v * Math.PI) / 2), now, 0.005);
  }

  setMaster(v: number): void {
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
  }

  setChSelect(ch: 1 | 2 | 'master'): void {
    this.chSelect = ch;
    this.applyEcho();
  }

  setEcho(on: boolean): void {
    this.echoOn = on;
    this.applyEcho();
  }

  setEchoLevel(v: number): void {
    this.echoLevel = v;
    this.applyEcho();
  }

  /** Echo time follows deck A's tempo: 3/4 beat. */
  private applyEcho(): void {
    const now = this.ctx.currentTime;
    const bpm = this.a.bpm || 125;
    this.delay.delayTime.setTargetAtTime((60 / bpm) * 0.75, now, 0.02);
    const send = this.echoOn ? this.echoLevel : 0;
    this.echoSendA.gain.setTargetAtTime(this.chSelect === 1 ? send : 0, now, 0.01);
    this.echoSendB.gain.setTargetAtTime(this.chSelect === 2 ? send : 0, now, 0.01);
    this.echoSendMaster.gain.setTargetAtTime(this.chSelect === 'master' ? send : 0, now, 0.01);
    this.echoWet.gain.setTargetAtTime(this.echoOn ? 0.8 : 0.8, now, 0.01);
  }

  /** Beat focus: low-pass the master at 220 Hz so only kicks are audible (beatmatch aid). */
  setBeatFocus(on: boolean): void {
    this.focus.frequency.setTargetAtTime(on ? 220 : 20000, this.ctx.currentTime, 0.02);
  }

  /** Match B's tempo to A's (SYNC). */
  sync(deck: 'A' | 'B'): void {
    const src = deck === 'A' ? this.b : this.a;
    const dst = deck === 'A' ? this.a : this.b;
    if (!src.spec || !dst.spec) return;
    dst.setRate((src.spec.bpm * src.state().rate) / dst.spec.bpm);
    const phase = dst.phaseTo(src);
    if (dst.state().playing) dst.seek(dst.beatAt() - phase);
  }

  /** Peak level 0..1 for meters. */
  level(): number {
    const data = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(data);
    let peak = 0;
    for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
    return peak;
  }

  tick(): void {
    this.a.tick();
    this.b.tick();
  }
}
