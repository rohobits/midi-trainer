# MIDI Trainer — feature spec

The product spec distilled from the September 2026 research pass (`docs/research/`). Priority
key: **P1** = v1 (M1), **P2** = M2, **P3** = M3, **P4** = M4+. "Diff" marks a differentiator no
shipping product has. Milestone definitions are at the end.

## Positioning

Guitar Hero for DJ controllers and pianos, with real lessons. Every lesson is verified by
input: taps scored in ms, faders and knobs scored on tracking against a visible path. The
whitespace the research found: no product scores real fader, knob or jog movement, and none
gives ms-level pad timing for DJ drills on a DDJ-FLX4. Local-first; the free tier is usable;
accounts arrive only with leaderboards.

## 1. Input and hardware
- P1 Web MIDI discovery, hot-plug, multiple inputs; never exclusive (rekordbox keeps working).
- P1 FLX4 profile: every control named as printed, per deck; pad modes as mode-qualified controls; jog touch and rotate; TEMPO; faders; crossfader; TRIM/HI/MID/LOW; CFX; BEAT FX ON/OFF and CH SELECT; FX level; SMART FADER; SMART CFX; IN/4BEAT, OUT, RELOOP/EXIT; SYNC, CUE, PLAY; headphone cue; master.
- P1 MIDI-learn (single, all-in-order, skip, clear), map export/import JSON, per-entry `verified` flag with an unverified badge. Default map ships empty until an export from real hardware is committed. No MIDI numbers typed from memory.
- P1 Generic profile for any controller. On-screen fallback input. Piano88 at prototype parity.
- P2 Jog wheel as relative encoder. Calibration wizard (tap 16 times, set input offset from the median bias, per device); hit-window overlay.
- P3 Presets for other Pioneer DDJs, Hercules, Numark from exported maps. P4 Wireless crossfader, DVS.

## 2. Feedback and scoring
- P1 Prototype judges preserved: tap ±0.35 beat, linear to 0 at 150 ms; ramp mean abs error, hit < 0.18, zero at 0.30; hold; note wait/play-along ±0.30 beat.
- P1 Judgement tiers Perfect ±40 / Great ±90 / OK ±140 ms / Miss with one strictness knob; signed ms shown; green on time, orange early, purple late, red wrong control.
- P1 Score /100; medals bronze 80 / silver 90 / gold 96; pass = bronze unless the drill says otherwise; sub-scores for pad timing and tracking; extra presses counted, not scored.
- P2 CUT judge (traverse time + landing offset). Diff. CROSS constraint (mirrored ramps, exclusivity). Diff. ALTERNATE judge (on/off pattern on a subdivision grid, click count). Diff. STEP judge (halve/double on bar boundaries, exit on the one). Timing histogram and bias.
- P3 JOG NUDGE / JOG STROKE judges. Diff. SELECT judge (Camelot, curve, CH SELECT, key shift, BPM ratio). SEQUENCE chains.
- P4 Freestyle windows scored on activity.

## 3. Practice tools
- P1 Metronome with accent, count-in, tap tempo, BPM override, loop, auto-start on Play A, Space, restart. Wait mode for piano.
- P2 Wait mode for pad drills; section loop; tempo 50–110%; deck/mixer/hand isolation; Auto-BPM ladder (clean at 80/90/100% → level up, reset to 80%); master mode (highway fades after three golds); no-fail default.
- P3 Dynamic density. P4 Beat-focus low-pass and strobe-dot drift (needs audio).

## 4. Curriculum and content
- P1 Drills as JSON with Zod schema; 13 DJ drills + 5 piano exercises; markdown lesson on every drill; tiers, prereqs, pass score, per-drill thresholds; metadata `skills`, `genre`, `requires`, `sources`, `artist`, `needsAudio`, `path`, `level`; browser grouped by tier with unavailable reasons.
- P2 Paths (Pads, Mixer, Transitions, Jog, FX, Combined) with soft gating; Foundations and Mixing packs expanded from the taxonomy (~40 drills); concept-then-play explainers.
- P3 Genre presets; signature-move packs (Carl Cox, James Hype, Fisher, Charlotte de Witte, Skrillex, DJ Craze, A-Trak, Grandmaster Flash), 2-deck reductions flagged.
- P4 Placement test. P5 Drill editor and pack sharing.

## 5. Gamification
- P1 Personal best, medals, results card.
- P2 Daily goal (5 min), streaks, trophies at 3/5/7/10/…/60, practice calendar, collectible records.
- P3 Performance mode (multiplier +1× per 10 hits to 4×, Euphoria, star rating); daily challenge (seeded, local); spaced review queue (Diff); XP and cosmetics.
- P4 Crowd meter and requests in song mode. P6 Weekly challenge with per-tier leaderboards.

## 6. Progression and analytics
- P1 Attempt history in IndexedDB with `inputLog`; per-drill list and trend.
- P2 Dashboard; "ready for next tier"; replay scrubber. P3 Ghost compare; timing bias trend. P4 Session report export; teacher view.

## 7. Audio (M4)
Dual-deck WebAudio with beat-gridded royalty-free stems; faders, EQ, filter, echo on audio nodes. Unlocks beatmatch-by-ear, Fuser-style downbeat drops, song mode, stems drills. Removes the rekordbox dependency.

## 8. Monetisation (M6)
Free: Foundations, generic profile, history, daily goal. Pro: full packs, signature moves, replay, challenges, cloud sync. Monthly/annual/lifetime; content packs; hardware bundle codes. Avoid daily minute caps, first-lesson paywalls, trial traps.

## Skills → milestones

See `docs/research/skills.md` for the full cited taxonomy. Mapping of each technique to a scoring primitive and the milestone whose judges can score it ("A" = needs audio):

- **Foundations**: counting (TAP, M1); headphone cueing (SELECT+TAP, M3); cue on the downbeat (TAP, M1); gain staging (HOLD, M1); tempo matching (RAMP, M1); jog nudge (JOG, M3, A); tempo-fader ride (RAMP, M1); sustained beatmatch (JOG, A); SYNC then nudge (JOG, A); fader blend (RAMP, M1); curve choice (SELECT, M3); CFX return to detent (RAMP, M1).
- **Mixing**: phrase-matched mix in (TAP, M1); bass swap (CROSS, M2); staggered EQ (RAMP M1, CROSS M2); long EQ morph (RAMP, M1); filter mix-out (RAMP, M1); full-volume outro/intro (HOLD+CROSS, M2); drop mix (CUT, M2); fader chops (ALTERNATE, M2); echo out (SEQUENCE M3; TAP+CUT M2); backspin/brake via Pad FX (TAP+CUT M2; JOG STROKE M3); reverb wash (TAP+RAMP, M1); loop the outro (TAP, M1); harmonic mixing, energy boost, key shift (SELECT, M3).
- **Performance**: loop roll (STEP, M2); drop swap (TAP+CUT, M2); double drop (M1 approx, M2 exact); Fisher entry (M2); breakdown swap (M2); flanger build (TAP+HOLD, M1); beat roll build (STEP, M2); Smart CFX sweep and Smart Fader (RAMP, M1); beat jump (SELECT+TAP, M3); instant doubles (SEQUENCE, M3, A); sampler drops (TAP, M1); Pad FX stabs (HOLD, M1); censor (HOLD, A); acapella layering (A); tempo bridging (M3, A); tempo creep (RAMP, M1); quick mixing (TAP+CUT, M2); power blocks (M3).
- **Advanced**: hot cue drumming (ALTERNATE M2; prototype M1); cue juggling (SEQUENCE, M3); word play (A); tone play (M3, A); stem swaps (CROSS M2 schema, A); live remixing (M3); scratching basic and advanced (JOG STROKE + ALTERNATE, M3); routines (M3); beat juggling (M3, A); cue-point scratch (M3).
- **Pro/signature**: Cox (M3, needs 3 decks), Hype (M2/M3, 2-deck reduction), Fisher (M2), de Witte (M1/M2), Skrillex (M3), Craze and A-Trak (M3), Flash (M3, A).

## Milestones

- **M1 — v1, parity plus.** PR 1 repo, engine core, docs; PR 2 FLX4 profile; PR 3 Piano88 parity; PR 4 history, settings, calibration. Exit: works on Chrome + FLX4 + rekordbox; exported map committed.
- **M2 — curriculum and practice tools.** Judges cut/cross/alternate/step; wait mode for pads; section loop; Auto-BPM; master mode; paths; expanded packs; replay; daily goal/streaks/trophies/records; dashboard.
- **M3 — game layer and jog.** Jog input and judges; scratch primitives; performance mode; daily challenge; spaced review; ghost compare; XP; genre presets; signature packs; sync spike; Tauri decision.
- **M4 — audio engine.** Dual-deck WebAudio; beatmatch-by-ear; song mode; placement test; session mode.
- **M5 — authoring and community.** Drill editor; pack sharing; clips; teacher view; generative variants.
- **M6 — monetisation.** Accounts, sync, weekly challenge, leaderboards, free/Pro split, bundle codes.
