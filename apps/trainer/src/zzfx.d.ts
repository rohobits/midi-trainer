declare module 'zzfx' {
  export function zzfx(...params: (number | undefined)[]): AudioBufferSourceNode;
  export const ZZFX: {
    volume: number;
    sampleRate: number;
    x: AudioContext;
    play(...params: (number | undefined)[]): AudioBufferSourceNode;
    playSamples(...samples: number[][]): AudioBufferSourceNode;
    buildSamples(...params: (number | undefined)[]): number[];
  };
}
