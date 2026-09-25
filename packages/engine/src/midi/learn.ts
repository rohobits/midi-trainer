import type { MidiEvent } from './parse';
import type { ControlDef } from '../profiles/types';
import type { ControlMap } from './map';

/**
 * MIDI-learn session. Arm one control (or a queue), feed events; a press-type control
 * takes the next note-on, a continuous control takes the next CC. Mutates `map`.
 */
export class LearnSession {
  private armed: string | null = null;
  private queue: string[] = [];

  constructor(
    private controls: readonly ControlDef[],
    public map: ControlMap,
  ) {}

  get current(): string | null {
    return this.armed;
  }

  get pending(): readonly string[] {
    return this.queue;
  }

  arm(controlId: string): void {
    this.queue = [];
    this.armed = controlId;
  }

  /** Arm every control in order (or a given list). */
  armAll(ids?: string[]): void {
    this.queue = ids ? [...ids] : this.controls.map((c) => c.id);
    this.armed = this.queue.shift() ?? null;
  }

  skip(): void {
    this.armed = this.queue.shift() ?? null;
  }

  cancel(): void {
    this.armed = null;
    this.queue = [];
  }

  /**
   * Offer an event. Returns the control that got mapped, or null if the event was ignored
   * (nothing armed, or wrong kind for the armed control).
   */
  offer(ev: MidiEvent, note?: string): string | null {
    if (!this.armed) return null;
    const def = this.controls.find((c) => c.id === this.armed);
    if (!def) {
      this.skip();
      return null;
    }
    if (def.kind === 'tap' && ev.kind !== 'noteon') return null;
    if (def.kind === 'cc' && ev.kind !== 'cc') return null;
    const id = this.armed;
    this.map[id] = { key: ev.key, verified: true, ...(note ? { note } : {}) };
    this.armed = this.queue.shift() ?? null;
    return id;
  }
}
