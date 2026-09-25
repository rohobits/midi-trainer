import type { ControlDef, Profile } from '../types';

/**
 * Pioneer DDJ-FLX4 control layout, named as printed on the panel. This file holds NO MIDI
 * numbers: the map is learned on hardware (see `default-map.ts`). Ids are stable and are
 * what drills reference. Prototype ids (`playA`, `hcA1`, `faderA`, `lowB`, `xf`, …) are kept
 * where the control is the same physical thing, so migrated drills run on this profile.
 */
type Deck = 'A' | 'B';
const tap = (id: string, name: string, group: string, deck?: Deck, mode?: string): ControlDef => ({
  id, name, kind: 'tap', group, ...(deck ? { deck } : {}), ...(mode ? { mode } : {}),
});
const cc = (id: string, name: string, group: string, defaultValue: number, deck?: Deck): ControlDef => ({
  id, name, kind: 'cc', group, defaultValue, ...(deck ? { deck } : {}),
});

function deckControls(d: Deck): ControlDef[] {
  const out: ControlDef[] = [
    tap(`play${d}`, `PLAY/PAUSE ${d}`, 'Transport', d),
    tap(`cue${d}`, `CUE ${d}`, 'Transport', d),
    tap(`sync${d}`, `BEAT SYNC ${d}`, 'Transport', d),
    tap(`shift${d}`, `SHIFT ${d}`, 'Transport', d),
    tap(`loop${d}`, `IN/4BEAT ${d}`, 'Loop', d),
    tap(`loopOut${d}`, `OUT ${d}`, 'Loop', d),
    tap(`reloop${d}`, `RELOOP/EXIT ${d}`, 'Loop', d),
    tap(`jogTouch${d}`, `Jog touch ${d}`, 'Jog', d),
    cc(`jog${d}`, `Jog rotate ${d}`, 'Jog', 0.5, d),
    cc(`tempo${d}`, `TEMPO ${d}`, 'Tempo', 0.5, d),
    tap(`padModeHotCue${d}`, `HOT CUE mode ${d}`, 'Pad modes', d),
    tap(`padModePadFx${d}`, `PAD FX mode ${d}`, 'Pad modes', d),
    tap(`padModeBeatJump${d}`, `BEAT JUMP mode ${d}`, 'Pad modes', d),
    tap(`padModeSampler${d}`, `SAMPLER mode ${d}`, 'Pad modes', d),
  ];
  const modes: Array<[string, string, string]> = [
    ['hc', 'Hot cue', 'HOT CUE'],
    ['padFx', 'Pad FX', 'PAD FX'],
    ['beatJump', 'Beat jump', 'BEAT JUMP'],
    ['sampler', 'Sampler', 'SAMPLER'],
    ['keyboard', 'Keyboard', 'KEYBOARD'],
    ['padFx2', 'Pad FX 2', 'PAD FX 2'],
    ['beatLoop', 'Beat loop', 'BEAT LOOP'],
    ['keyShift', 'Key shift', 'KEY SHIFT'],
  ];
  for (const [prefix, label, mode] of modes) {
    for (let i = 1; i <= 8; i++) out.push(tap(`${prefix}${d}${i}`, `${label} ${d}${i}`, `Pads · ${mode}`, d, mode));
  }
  out.push(
    cc(`trim${d}`, `TRIM ${d}`, 'Mixer', 0.5, d),
    cc(`hi${d}`, `HI ${d}`, 'EQ', 0.5, d),
    cc(`mid${d}`, `MID ${d}`, 'EQ', 0.5, d),
    cc(`low${d}`, `LOW ${d}`, 'EQ', 0.5, d),
    cc(`filt${d}`, `CFX ${d}`, 'Filter', 0.5, d),
    cc(`fader${d}`, `Channel fader ${d}`, 'Mixer', 0, d),
    tap(`cueHp${d}`, `Headphone CUE ${d}`, 'Mixer', d),
  );
  return out;
}

export const FLX4_CONTROLS: readonly ControlDef[] = [
  ...deckControls('A'),
  ...deckControls('B'),
  cc('xf', 'Crossfader', 'Mixer', 0),
  cc('master', 'MASTER LEVEL', 'Mixer', 0.5),
  cc('hpMix', 'Headphones MIX', 'Mixer', 0.5),
  cc('hpLevel', 'Headphones LEVEL', 'Mixer', 0.5),
  tap('beatFxOn', 'BEAT FX ON/OFF', 'FX'),
  tap('beatFxSelect', 'BEAT FX SELECT', 'FX'),
  tap('chSelect1', 'CH SELECT 1', 'FX'),
  tap('chSelect2', 'CH SELECT 2', 'FX'),
  tap('chSelectMaster', 'CH SELECT MASTER', 'FX'),
  cc('fxLevel', 'BEAT FX LEVEL/DEPTH', 'FX', 0),
  tap('beatLeft', 'BEAT ◀', 'FX'),
  tap('beatRight', 'BEAT ▶', 'FX'),
  tap('smartFader', 'SMART FADER', 'Smart'),
  tap('smartCfx', 'SMART CFX', 'Smart'),
  cc('samplerVol', 'SAMPLER VOLUME', 'Mixer', 0.5),
  tap('browseLoadA', 'LOAD A', 'Browse'),
  tap('browseLoadB', 'LOAD B', 'Browse'),
  tap('browsePush', 'Rotary push', 'Browse'),
  cc('browseTurn', 'Rotary turn', 'Browse', 0.5),
];

export const FLX4_PROFILE: Profile = {
  id: 'flx4',
  name: 'Pioneer DDJ-FLX4',
  input: 'controls',
  controls: FLX4_CONTROLS,
  capabilities: ['decks:2', 'beatfx:1', 'pads:8', 'jog', 'smart-fader', 'smart-cfx'],
};

/**
 * Prototype control ids that have no same-named FLX4 control. `fxA`/`fxB` never existed on
 * the FLX4 (one BEAT FX with CH SELECT); drills using them are rewritten to `beatFxOn`.
 */
export const FLX4_ALIASES: Readonly<Record<string, string>> = {
  fxA: 'beatFxOn',
  fxB: 'beatFxOn',
};
