# Sync investigation (Milestone 3 spike)

**Question.** Can the trainer lock its drill clock to rekordbox so a 64-bar drill stays
phase-accurate without relying on the user pressing Play A on a downbeat?

**What is built.** `packages/engine/src/midi/clock.ts` listens for MIDI beat clock (0xF8 at
24 ppqn, 0xFA/0xFB/0xFC transport) on any connected input, estimates BPM from the last four
beats of ticks, and reports beat phase. The practice view shows the incoming BPM and the
drift in ms between the external beat and the drill clock; the "Follow MIDI clock" setting
makes the drill BPM track the sender. Nothing locks phase automatically yet.

**Findings.**

- rekordbox does not transmit MIDI clock from the DDJ-FLX4 USB port. The FLX4's MIDI
  output carries button LED feedback and jog/platter state, not a beat clock. So the
  listener has nothing to lock to in the owner's setup unless a clock source is added.
- Options that would give a real lock:
  1. **Ableton Link bridge.** A tiny local process (Tauri sidecar or Node) joins the Link
     session rekordbox exposes (rekordbox 6.6+ supports Link) and forwards the beat/phase to
     the browser over a WebSocket. Most reliable; needs the desktop packaging decision.
  2. **MIDI clock from a second device.** Any Link-to-MIDI or DAW clock master (Ableton,
     a hardware clock box) into the Mac's IAC bus. Web MIDI sees it. Works today with the
     listener that is already built.
  3. **Jog/LED feedback decoding.** The FLX4 sends jog position and beat-LED messages the
     trainer could parse for phase. Unverified numbers; would need a learn session per
     firmware. Fragile; not pursued.
- With the anchor-based transport, free-running drift over 64 bars at a correct BPM is
  under 5 ms on a desktop Chrome timer. The pain point is the start, not the drift:
  pressing Play A on the downbeat is a human ±30 ms event. The calibration wizard removes
  the systematic part; the random part stays.

**Decision.** Keep the free-running clock plus the clock listener for v1–v3. Revisit the
Link bridge together with the Tauri decision: it is the only route that gives phase lock
and it depends on a local process, which the web app cannot own.

**Tauri decision.** Not needed for anything shipped so far. Reasons to package later: the
Link bridge above, always-on-top during a set, and file-system drill packs without a file
picker. None blocks practice today; the PWA install covers "opens like an app".
