import { parseMidi, type MidiEvent } from './parse';

export interface MidiInputInfo {
  id: string;
  name: string;
  manufacturer: string;
}

export type MidiListener = (ev: MidiEvent, meta: { inputId: string; timeStamp: number }) => void;

/**
 * Thin Web MIDI wrapper. Never requests sysex and never closes ports it did not open,
 * so the controller stays shared with rekordbox on macOS.
 */
export class MidiAccess {
  private access: MIDIAccess | null = null;
  private listeners = new Set<MidiListener>();
  private stateListeners = new Set<(inputs: MidiInputInfo[]) => void>();
  private rawListeners = new Set<(bytes: Uint8Array, timeStamp: number) => void>();

  static get supported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
  }

  async connect(): Promise<MidiInputInfo[]> {
    if (!MidiAccess.supported) throw new Error('Web MIDI is not available in this browser. Use Chrome or Edge.');
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.bind();
    this.access.onstatechange = () => this.bind();
    return this.inputs();
  }

  inputs(): MidiInputInfo[] {
    const out: MidiInputInfo[] = [];
    this.access?.inputs.forEach((i) =>
      out.push({ id: i.id, name: i.name ?? 'MIDI input', manufacturer: i.manufacturer ?? '' }),
    );
    return out;
  }

  onEvent(fn: MidiListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Every incoming message, including system real-time (clock) bytes. */
  onRaw(fn: (bytes: Uint8Array, timeStamp: number) => void): () => void {
    this.rawListeners.add(fn);
    return () => this.rawListeners.delete(fn);
  }

  onStateChange(fn: (inputs: MidiInputInfo[]) => void): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  /** Inject bytes as if they arrived from an input (tests, on-screen controls). */
  inject(bytes: ArrayLike<number>, timeStamp = performance.now(), inputId = 'virtual'): void {
    const arr = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes as ArrayLike<number>);
    for (const l of this.rawListeners) l(arr, timeStamp);
    const ev = parseMidi(arr);
    if (ev) this.emit(ev, { inputId, timeStamp });
  }

  private emit(ev: MidiEvent, meta: { inputId: string; timeStamp: number }): void {
    for (const l of this.listeners) l(ev, meta);
  }

  private bind(): void {
    if (!this.access) return;
    this.access.inputs.forEach((input) => {
      input.onmidimessage = (m: MIDIMessageEvent) => {
        if (!m.data) return;
        for (const l of this.rawListeners) l(m.data, m.timeStamp);
        const ev = parseMidi(m.data);
        if (ev) this.emit(ev, { inputId: input.id, timeStamp: m.timeStamp });
      };
    });
    const list = this.inputs();
    for (const l of this.stateListeners) l(list);
  }
}
