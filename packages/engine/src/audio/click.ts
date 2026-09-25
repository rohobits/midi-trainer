/** Metronome and guide tones on a lazily created AudioContext (prototype sounds). */
export class Sounds {
  private ac: AudioContext | null = null;

  /** Create or resume the context. Call from a user gesture. */
  ensure(): void {
    if (!this.ac) {
      try {
        this.ac = new AudioContext();
      } catch {
        this.ac = null;
      }
    }
    if (this.ac && this.ac.state === 'suspended') void this.ac.resume();
  }

  get ready(): boolean {
    return !!this.ac;
  }

  /** Square click: 1500 Hz on the downbeat, 1000 Hz otherwise. */
  click(downbeat: boolean, downHz = 1500): void {
    const ac = this.ac;
    if (!ac) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'square';
    o.frequency.value = downbeat ? downHz : 1000;
    g.gain.setValueAtTime(0.12, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.06);
  }

  /** Triangle guide tone at MIDI note `n` for `secs`. */
  tone(n: number, secs: number): void {
    const ac = this.ac;
    if (!ac) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'triangle';
    o.frequency.value = 440 * Math.pow(2, (n - 69) / 12);
    g.gain.setValueAtTime(0, ac.currentTime);
    g.gain.linearRampToValueAtTime(0.18, ac.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + Math.max(0.15, secs * 0.9));
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + secs + 0.1);
  }
}
