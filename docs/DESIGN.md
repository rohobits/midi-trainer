# Design: "Booth"

The visual system for MIDI Trainer. Research behind it is in `docs/research/visual.md`
(highway conventions from Guitar Hero, Rock Band, YARG, DJ Hero, Beat Saber, Melodics,
osu!lazer, Thumper; chrome from rekordbox and Serato) and `docs/research/tooling.md`
(Canvas 2D, sprite glow, fonts, libraries).

## The idea

A DJ booth at 2 a.m. Matte-black hardware panels, screen-printed small-caps labels, one
backlit accent per control group, warm amber VU needles, cool-white readouts. The note
highway is a lit runway rising out of the console; the app chrome is the console. Nothing
is glass. Every colour means something.

Dark is the design and the default whatever the OS says. Light ("practice room") is an
opt-in in Settings and only flips the HTML chrome; the highway is always dark.

## Tokens (`apps/trainer/src/tokens.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--s0` `--s1` `--s2` `--s3` | `#0a0b0e` `#13151b` `#1c1f27` `#262a35` | stage, panel, raised, pad |
| `--line` `--line-strong` | `#2a2e39` `#3a3f4d` | hairlines |
| `--ink` `--muted` `--label` | `#f3f1ea` `#8e93a0` `#5e6472` | text |
| `--deck-a` `--deck-b` | `#38d5ff` `#ffb13b` | deck A / deck B controls, right / left hand |
| `--mixer` `--pads` `--fx` `--select` | `#ff4fa8` `#b6f23a` `#9f84ff` `#e9edf5` | mixer + crossfader, sampler pads, FX + filters, browse |
| `--perfect` `--great` `--ok` `--early` `--late` `--miss` | mint, cyan, yellow, orange, violet, red | judgement; miss shares no hue with a lane |
| `--euphoria` | `#7cf0ff` at 12% | whole-screen tint |
| `--bronze` `--silver` `--gold` | `#c97b4a` `#c9d1dc` `#f2c14e` | medals |

Type: Big Shoulders for display, score, combo, judgement, medals. Instrument Sans for UI.
JetBrains Mono for ms, BPM, keys, timers. `tabular-nums` on every animated number. All
three are self-hosted via `@fontsource-variable` so the PWA works offline.

Motion: micro 120 ms, standard 220 ms, panel 320 ms; enter `cubic-bezier(.2,.8,.2,1)`,
overshoot only on stamps. `prefers-reduced-motion` and the Reduced motion setting remove
shake, sparks, sunburst spin and count-ups.

## Highway (`packages/engine/src/render/highway.ts`)

- Opaque, desynchronised canvas. Projection: horizon at 0.10 H, strike at 0.82 H, "FOV"
  1.6 (Settings), lanes taper 62% toward the horizon. Lane widths are capped so a one-lane
  drill sits on a stage instead of stretching across the screen; the full floor is still
  drawn behind the lane group.
- Silhouette encodes type, colour encodes group. Tap = capsule; hold = capsule head with a
  trail; ramp = ribbon with a bright rail and dashed guide; cut = notched capsule with an
  outline; cross = full-width bar with an arrow; jog = disc with chevrons; select = ticket.
- Beat / bar / phrase grid with bar numbers; the lookahead auto-widens when the next target
  is far away, and the HUD always says what is next and in how many bars.
- Effects (`effects.ts`): pooled sparks and rings drawn from a sprite cache in one `lighter`
  pass; judgement popups; lane flashes; trauma² shake on a miss; combo counter with a
  10-segment multiplier arc; Euphoria sunburst and tint. No per-frame `shadowBlur`.
- Sound (`apps/trainer/src/ui/sfx.ts`): ZzFX arrays rendered to buffers once; tick, hit,
  perfect, miss, combo, score tick, medals, Euphoria. Mute in Settings.

## Layout rules

- HUD is its own band above the canvas: name and position left, progress bar with bar and
  phrase ticks centre, score and "next" right. Nothing is drawn over the highway.
- The toolbar is one rail of segmented pills; it fades to 30% after two seconds without
  pointer movement during a run.
- Results: arc fills 450 → 1600 ms with a pitch-rising tick, medal stamps, rows stagger,
  stars light left to right. Coach-toned copy comes from the numbers.
- Pages share the same panels, labels and lane colours: browse (tonight panel, skill map
  rings, drill cards with a lane-colour rule), decks (beat grid, platter, LED VU, fader
  slots), progress (calendar, medal shelf, records as sleeves), settings (two-column form
  with hardware switches), calibration (live ±ms scatter with a median needle).

## Verifying

`pnpm e2e` runs `e2e/visual.spec.ts`: frozen frames via `?test=1&t=<beats>&autostart=1`
compared against committed baselines with `maxDiffPixelRatio 0.04`, plus a frame-time
check (200 frames of the densest drill, mean under 16 ms in headless software rendering;
about 3 ms in practice).
