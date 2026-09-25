# Research: visual language of rhythm games and DJ software

Compiled 2026-09-25. Numbers marked from source were read from the YARG and osu! repositories;
other points come from reviews, wikis and developer talks. Sources at the end.

## What the references do

- **Guitar Hero III / World Tour.** Vertical pseudo-3D neck, five lanes, horizontal fret bars,
  round gems; Star Power gems star-shaped with cyan outline; activating recolours every note
  cyan and fires lightning from the highway edges. Reproducible with a trapezoid gradient,
  ellipses with a highlight arc and a palette swap.
- **Guitar Hero Live.** Three lanes; shape encodes which button row (black points up, white
  down). Shape can carry information as reliably as colour: use it for tap vs cut vs jog.
- **Rock Band 4.** Track art is rendered under the highway "like looking through glass";
  notes above; HUD in a separate band. The most useful structural rule.
- **YARG (open source).** Sustains: waiting = base colour, hitting = emission ×3, missed =
  greyscale at luminance 0.25. Fret press fade 0.25 s, cosine-eased pulse. Sunburst for groove
  and Star Power: rotates −25°/s, scales 0.4→1.0 over 0.433 s InSine, 0.85× pulse over 0.25 s
  on multiplier change. Combo meter is a 10-step sprite cycling `combo % 10`; multiplier text
  only when >1. Hit-window band height = window × note speed, offset by calibration.
- **Clone Hero.** Hit window 140 ms max, tightening to 40 ms in Precision Mode by note
  spacing; Star Power ending signalled by fading note colours; FOV slider for highway pitch.
- **DJ Hero 1/2.** Three lanes rotated like a record; crossfader lane centre; streams shift
  sideways when you must fade. Crossfader spikes were criticised as hard to see; Euphoria in
  the first game had no whole-screen effect. Cuts need a loud silhouette; Euphoria needs a
  screen state; the hardware button blinks when full.
- **Beat Saber.** Red `#C81414` vs blue `#288ED2`; dark void lit by mapper-driven light
  events. Two-hue contrast plus beat-synced lighting sells the club feel, not particles.
- **Melodics.** Notes recolour after play: perfect green, early orange, late purple, missed
  red; colourblind mode uses white plus icons; visuals are state machines driven by MIDI events.
- **Rocksmith+.** Environment made of dots that pulse with the song.
- **Spin Rhythm XD.** Neon pastels (cyan, magenta, yellow-green, purple); every element colour
  customisable.
- **osu!lazer.** Judgement colours Perfect `#99EEFF`, Great `#66CCFF`, Good `#B3D944`, Ok
  `#88B300`, Meh `#FFCC22`, Miss `#ED1121`. Results: panel 200 ms OutQuint; rank ring fills
  after 150 ms over 800 ms; accuracy arc after 450 ms over 3000 ms OutPow10; rank letter at
  1500 ms; stat rows 200 ms apart; sounds: swoosh, pitch-rising score tick, a dink per badge,
  rank impact. Critique: wedge panels and blurred art leave little room for information.
- **Thumper.** Chrome plus organic, no particles or fancy lighting; wide FOV, camera shake and
  motion blur sell speed; every element communicates. Restraint reads as premium.
- **Rhythm Doctor.** Hits spawn particles, camera zoom, and "shake screen" is a first-class
  event.
- **rekordbox 7 / Serato / Traktor / djay.** Matte near-black, hairline-divided panels, one
  brand hue (rekordbox went blue to match hardware), RGB or 3-band waveforms as the hero
  graphic, warm VU meters.
- **Yousician / Simply / Flowkey.** 1 silver to 3 gold stars, score top-right, end screen with
  Play again / Practice / Perfect it / Continue; left-to-right learning path.

## Sources

Star Power wiki (guitarhero.fandom.com/wiki/Star_Power); Guitar Hero World Tour and Guitar Hero
Live (Wikipedia); Harmonix Rock Band 4 blog (harmonixmusic.com/blog/new-rock-band-4-update-now-out);
YARG Visuals (github.com/YARC-Official/YARG/tree/master/Assets/Script/Gameplay/Visuals:
SustainLine.cs, Fret.cs, SunburstEffects.cs, ComboMeter.cs, HitWindowDisplay.cs); Clone Hero
precision mode (x.com/CloneHero/status/1351623992218701832) and v1.1 notes (clonehero.net);
DJ Hero series wiki (guitarhero.fandom.com/wiki/DJ_Hero_(series)); TheSixthAxis and Dualshockers
DJ Hero reviews; BSMG map format and lighting (bsmg.wiki); HitScoreVisualizer
(github.com/ErisApps/HitScoreVisualizer); Melodics settings (support.melodics.com/en/articles/6777096)
and Rive case study (rive.app/blog); Rocksmith+ dev diary (ubisoft.com); GamerEscape Spin Rhythm
preview; osu! OsuColour.cs and AccuracyCircle.cs (github.com/ppy/osu); Thumper at Game Developer
and GDC Vault; Rhythm Doctor at Game Developer and wiki.rhythm.cafe; rekordbox 7 announcement
(rekordbox.com/en/2024/05/introducing-rekordbox-ver-7/); Serato display modes; Traktor Pro 4;
Algoriddim djay Pro; Yousician song end screen (support.yousician.com/hc/en-us/articles/201558472).
