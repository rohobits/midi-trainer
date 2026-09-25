import { LOOP_BARS, LOOP_STEPS, STEPS_PER_BAR, makePatterns, type Patterns, type StemName, type TrackSpec } from './patterns';

export type StemBuffers = Record<StemName, AudioBuffer>;

/**
 * Render the 4-bar stem loops for a track spec with an OfflineAudioContext. Mono at a low
 * sample rate keeps memory small (a few hundred kB per stem); the live context resamples.
 * Everything is synthesized: no licensed audio anywhere in the app.
 */
export async function renderStems(spec: TrackSpec, sampleRate = 22050): Promise<StemBuffers> {
  const patterns = makePatterns(spec);
  const secPerBeat = 60 / spec.bpm;
  const loopSec = secPerBeat * 4 * LOOP_BARS;
  const stepSec = secPerBeat / 4;
  const render = async (fn: (ctx: OfflineAudioContext) => void, seconds = loopSec) => {
    const ctx = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
    fn(ctx);
    return ctx.startRendering();
  };
  const noise = (ctx: OfflineAudioContext, seconds: number) => {
    const buf = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  };
  const kick = await render((ctx) => {
    for (let s = 0; s < LOOP_STEPS; s++) {
      if (!patterns.kick[s]) continue;
      const t = s * stepSec;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.4);
      const c = ctx.createBufferSource();
      c.buffer = noise(ctx, 0.01);
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.3, t);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.01);
      c.connect(cg).connect(ctx.destination);
      c.start(t);
    }
  });
  const nb = (ctx: OfflineAudioContext) => noise(ctx, 0.4);
  const clap = await render((ctx) => {
    const buf = nb(ctx);
    for (let s = 0; s < LOOP_STEPS; s++) {
      if (!patterns.clap[s]) continue;
      const t = s * stepSec;
      for (const off of [0, 0.012, 0.024, 0.04]) {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1600;
        bp.Q.value = 0.8;
        const g = ctx.createGain();
        g.gain.setValueAtTime(off === 0.04 ? 0.7 : 0.35, t + off);
        g.gain.exponentialRampToValueAtTime(0.001, t + off + (off === 0.04 ? 0.22 : 0.03));
        src.connect(bp).connect(g).connect(ctx.destination);
        src.start(t + off);
        src.stop(t + off + 0.3);
      }
    }
  });
  const hat = await render((ctx) => {
    const buf = nb(ctx);
    for (let s = 0; s < LOOP_STEPS; s++) {
      const kind = patterns.hat[s];
      if (!kind) continue;
      const t = s * stepSec;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(kind === 2 ? 0.35 : 0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 2 ? 0.18 : 0.05));
      src.connect(hp).connect(g).connect(ctx.destination);
      src.start(t);
      src.stop(t + 0.25);
    }
  });
  const bass = await render((ctx) => {
    for (let s = 0; s < LOOP_STEPS; s++) {
      const n = patterns.bass[s];
      if (n == null) continue;
      const t = s * stepSec;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 440 * Math.pow(2, (n - 69) / 12);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(900, t);
      lp.frequency.exponentialRampToValueAtTime(200, t + 0.25);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + stepSec * 1.8);
      o.connect(lp).connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + stepSec * 2);
    }
  });
  const pad = await render((ctx) => {
    patterns.chords.forEach((chord, bar) => {
      const t = bar * STEPS_PER_BAR * stepSec;
      const len = STEPS_PER_BAR * stepSec;
      for (const n of chord) {
        for (const det of [-6, 6]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = 440 * Math.pow(2, (n - 69) / 12);
          o.detune.value = det;
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 1400;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.08, t + 0.15);
          g.gain.setValueAtTime(0.08, t + len - 0.2);
          g.gain.linearRampToValueAtTime(0, t + len);
          o.connect(lp).connect(g).connect(ctx.destination);
          o.start(t);
          o.stop(t + len + 0.05);
        }
      }
    });
  });
  const riser = await render((ctx) => {
    const src = ctx.createBufferSource();
    src.buffer = noise(ctx, loopSec);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(300, 0);
    bp.frequency.exponentialRampToValueAtTime(6000, loopSec);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, 0);
    g.gain.linearRampToValueAtTime(0.4, loopSec);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(0);
  });
  return { kick, clap, hat, bass, pad, riser };
}

export { makePatterns };
export type { Patterns };
