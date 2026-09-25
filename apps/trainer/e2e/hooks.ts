export interface Hook {
  injectMidi(bytes: number[], timeStamp?: number): void;
  setMap(map: Record<string, { key: string; verified: boolean }>): void;
  navigate(to: string): void;
  state(): { route: string; drills: number; attempts: number; profile: string };
}
export interface PracticeHook {
  run(): { phase: string; extraPresses: number; pos(now: number): number; stats(): { score: number | null; tiers: Record<string, number> } } | null;
  startedAt(): number;
  start(): void;
  loadDrill(id: string): void;
  finish(): Promise<void> | undefined;
  benchmark(n?: number): number | null;
}
declare global {
  interface Window {
    __trainer: Hook;
    __practice: PracticeHook;
    __frameReady?: boolean;
  }
}
export {};
