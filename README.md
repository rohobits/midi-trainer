# MIDI Trainer

Guitar Hero-style practice trainer for MIDI instruments and controllers. Pioneer DDJ-FLX4
first, 88-key piano second, any MIDI controller via MIDI-learn. Taps are scored in
milliseconds with Perfect / Great / OK judgements; faders and knobs are scored on how closely
you track a visible path. Every drill carries a written lesson explaining why the technique
works. Drills are data (JSON), so adding one never touches code.

## Run it

```sh
pnpm i && pnpm dev
```

Open the printed URL in Chrome or Edge (Web MIDI). Plug the controller in over USB; rekordbox
can stay open on macOS. Click **Map controls**, then **Map all in order**, and touch each
control as it lights up. Pick a drill, play a track on deck A, set the BPM, and press Play A
(or Space) on a phrase downbeat. The drill clock starts from that press.

Other scripts: `pnpm check` (lint, typecheck, unit tests), `pnpm build`, `pnpm e2e`
(Playwright smoke; locally set `PW_CHROMIUM_PATH` to a Chromium binary if the bundled one
is missing), `pnpm preview`.

## Layout

```
packages/engine   framework-free core: MIDI, clock, drill schema, judges, profiles, storage, renderer
apps/trainer      the app (vanilla TypeScript + Vite)
content/drills    drills as JSON, one file each, grouped by profile and tier
docs/FEATURES.md  product spec and milestone plan
docs/DESIGN.md    the "Booth" visual system: tokens, highway, layout rules
docs/research/    the competitive, mechanics and skills research the spec is built on
prototypes/       the two single-file prototypes this repo was extracted from (reference only)
```

## Add a drill

Create `content/drills/dj/<tier>/<id>.json` (or `content/drills/piano/<id>.json`). Times are
in beats from the start, 4/4; values are 0–1. Minimal example:

```json
{
  "id": "eight-bar-fade",
  "name": "Eight-bar fade",
  "tier": "Foundations",
  "profile": "flx4",
  "bpm": 125,
  "bars": 8,
  "targets": [
    { "type": "tap", "c": "playB", "t": 0 },
    { "type": "ramp", "c": "faderB", "t": 0, "t1": 32, "v0": 0, "v1": 1 }
  ],
  "lesson": "## Why\n\nBring B in over a full phrase so the two kicks never fight.",
  "skills": ["fader-blend"],
  "sources": ["https://www.digitaldjtips.com/rock-the-dancefloor/five-basic-dj-transitions/"]
}
```

Target types: `tap`, `ramp`, `hold`, `note`, `cut`, `cross`, `alternate`, `step`, `jog`, `select`, `sequence`. The schema lives in
`packages/engine/src/drills/schema.ts` and every file under `content/` is validated in CI.
You can also load a drill file at runtime with **Load drill .json**.

## Export a map

Map your controller once, then **Export JSON** in the Map controls dialog. To make it the
shipped default for a profile, paste the entries into
`packages/engine/src/profiles/flx4/default-map.ts`. The default map is intentionally empty
until an export from real hardware exists: MIDI numbers are never typed from memory, and
every entry says where it came from.

## Scoring

Carried over from the prototypes and tunable per drill (`thresholds`) or globally:

| | default |
|---|---|
| tap window | ±0.35 beat |
| tap score | 1 at 0 ms, linear to 0 at 150 ms |
| ramp hit | mean abs error < 0.18 |
| ramp score | 1 at 0, linear to 0 at 0.30 |
| judgement tiers | Perfect ±40 ms, Great ±90 ms, OK ±140 ms |
| medals | bronze 80, silver 90, gold 96 |

## What's in the app

- **Drills**: 91 DJ drills across Foundations, Mixing, Performance, Advanced and Pro
  (signature moves, source-cited), organised into six paths with levels; 5 piano exercises;
  a generator (templates × genre presets); the daily challenge; a spaced review queue; the
  placement test.
- **Practice**: ms-accurate judging with Perfect / Great / OK tiers and medals, tempo scale,
  section loop, wait mode, deck or mixer isolation, master mode, performance mode
  (multiplier, Euphoria, energy, stars), ghost of your best run, on-screen controller.
- **Piano**: falling notes, wait / play-along, hands, guide tones, `.mid` import.
- **Decks**: two synthesized tracks (no licensed audio) through an FLX4-shaped mixer with
  EQ, filter, echo, loops, hot cues, sync, jog nudge, brake and backspin. Free-mix session
  scoring, beatmatch-by-ear with strobe dots and reveal, song mode with a crowd meter and
  requests.
- **Progress**: streaks, daily goal, trophies, calendar, XP and levels, records, medals by
  tier, accuracy by control type, timing histograms, replay scrubber, printable report.
- **Editor**: timeline plus JSON with live validation, pack export / import.
- **Look**: a pseudo-3D note highway with lane colours per control group, hit effects,
  combo and Euphoria states, game sounds, a results sheet, and first-run onboarding. Dark
  by default; see `docs/DESIGN.md`.
- **Settings**: thresholds, strictness, calibration wizard with per-device offsets, themes,
  backup export / import. Installs as a PWA.

Milestone 6 (accounts, sync, leaderboards, paid tiers) is deliberately not built; the
decisions it needs are listed in `docs/MONETISATION.md`. The sync investigation is in
`docs/SYNC.md`.
