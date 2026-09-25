import { ZZFX } from 'zzfx';

/**
 * UI sound set. Each sound is a ZzFX parameter array rendered once to an AudioBuffer and
 * played through one compressor, so playback is sample-accurate and costs nothing at call
 * time. Nothing plays before the first user gesture (the context resumes on `unlock`).
 */
type Params = (number | undefined)[];
const _ = undefined;
const SOUNDS = {
  tick: [0.3, 0, 1000, 0.001, 0.008, 0.03, 1, 1.2, _, _, _, _, _, 0.4],
  tickDown: [0.4, 0, 1500, 0.001, 0.01, 0.04, 1, 1.2, _, _, _, _, _, 0.4],
  hit: [0.32, 0, 880, 0.001, 0.02, 0.06, 0, 1, -30, _, _, _, _, 0.2],
  perfect: [0.38, 0, 1320, 0.001, 0.03, 0.09, 0, 1, -24, _, _, _, _, 0.15],
  miss: [0.4, 0, 90, 0.004, 0.05, 0.12, 1, 1.5, _, _, _, _, _, 0.5],
  combo: [0.35, 0, 660, 0.001, 0.05, 0.09, 0, 1, _, _, 330, 0.05],
  scoreTick: [0.12, 0, 1200, 0.001, 0.004, 0.012, 0, 1],
  medalBronze: [0.5, 0, 523, 0.01, 0.12, 0.28, 0, 1, _, _, 130, 0.08, _, _, _, _, 0.12],
  medalSilver: [0.5, 0, 659, 0.01, 0.12, 0.3, 0, 1, _, _, 130, 0.08, _, _, _, _, 0.14],
  medalGold: [0.6, 0, 784, 0.01, 0.14, 0.4, 0, 1, _, _, 196, 0.08, _, _, 20, _, 0.18],
  euphoria: [0.45, 0, 200, 0.05, 0.2, 0.3, 2, 1, 60, _, _, _, _, _, _, _, 0.1],
  select: [0.2, 0, 700, 0.001, 0.01, 0.03, 1, 1],
  thunk: [0.5, 0, 120, 0.002, 0.03, 0.09, 1, 2, -20],
} satisfies Record<string, Params>;
export type SfxName = keyof typeof SOUNDS;

export class Sfx {
  private ctx: AudioContext | null = null;
  private out: DynamicsCompressorNode | null = null;
  private buffers = new Map<SfxName, AudioBuffer>();
  muted = false;

  /** Call from a user gesture: creates the context and pre-renders every sound. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    this.out = this.ctx.createDynamicsCompressor();
    this.out.threshold.value = -18;
    this.out.ratio.value = 4;
    const master = this.ctx.createGain();
    master.gain.value = 0.7;
    this.out.connect(master).connect(this.ctx.destination);
    ZZFX.sampleRate = this.ctx.sampleRate;
    for (const [name, params] of Object.entries(SOUNDS) as [SfxName, Params][]) {
      const samples = ZZFX.buildSamples(...params);
      const buf = this.ctx.createBuffer(1, samples.length, this.ctx.sampleRate);
      buf.getChannelData(0).set(samples);
      this.buffers.set(name, buf);
    }
  }

  get ready(): boolean {
    return !!this.ctx;
  }

  play(name: SfxName, opts: { gain?: number; rate?: number; at?: number } = {}): void {
    if (this.muted || !this.ctx || !this.out) return;
    const buf = this.buffers.get(name);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate ?? 1;
    const g = this.ctx.createGain();
    g.gain.value = opts.gain ?? 1;
    src.connect(g).connect(this.out);
    src.start(opts.at ?? this.ctx.currentTime);
  }

  /** Rising score tick: pitch climbs with progress 0..1. */
  scoreTick(progress: number): void {
    this.play('scoreTick', { rate: 1 + progress * 0.8, gain: 0.6 });
  }
}
