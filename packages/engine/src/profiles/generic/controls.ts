import type { ControlDef, Profile } from '../types';

/**
 * The prototype's generic control list, kept for controllers without a dedicated
 * profile. Ids are unchanged so the migrated drills and any saved `djt-map` still apply.
 */
const tap = (id: string, name: string, group: string, deck?: 'A' | 'B'): ControlDef => ({ id, name, kind: 'tap', group, ...(deck ? { deck } : {}) });
const cc = (id: string, name: string, group: string, defaultValue: number, deck?: 'A' | 'B'): ControlDef => ({ id, name, kind: 'cc', group, defaultValue, ...(deck ? { deck } : {}) });

export const GENERIC_CONTROLS: readonly ControlDef[] = [
  tap('playA', 'Play A', 'Transport', 'A'), tap('cueA', 'Cue A', 'Transport', 'A'), tap('syncA', 'Sync A', 'Transport', 'A'),
  tap('playB', 'Play B', 'Transport', 'B'), tap('cueB', 'Cue B', 'Transport', 'B'), tap('syncB', 'Sync B', 'Transport', 'B'),
  tap('hcA1', 'Hot cue A1', 'Hot cues', 'A'), tap('hcA2', 'Hot cue A2', 'Hot cues', 'A'), tap('hcA3', 'Hot cue A3', 'Hot cues', 'A'), tap('hcA4', 'Hot cue A4', 'Hot cues', 'A'),
  tap('hcB1', 'Hot cue B1', 'Hot cues', 'B'), tap('hcB2', 'Hot cue B2', 'Hot cues', 'B'), tap('hcB3', 'Hot cue B3', 'Hot cues', 'B'), tap('hcB4', 'Hot cue B4', 'Hot cues', 'B'),
  tap('loopA', 'Loop A (in / auto)', 'Loops', 'A'), tap('loopOutA', 'Loop out / exit A', 'Loops', 'A'),
  tap('loopB', 'Loop B (in / auto)', 'Loops', 'B'), tap('loopOutB', 'Loop out / exit B', 'Loops', 'B'),
  tap('fxA', 'FX on A', 'FX', 'A'), tap('fxB', 'FX on B', 'FX', 'B'),
  cc('faderA', 'Channel fader A', 'Mixer', 0, 'A'), cc('faderB', 'Channel fader B', 'Mixer', 0, 'B'), cc('xf', 'Crossfader', 'Mixer', 0),
  cc('hiA', 'EQ Hi A', 'EQ', 0.5, 'A'), cc('midA', 'EQ Mid A', 'EQ', 0.5, 'A'), cc('lowA', 'EQ Low A', 'EQ', 0.5, 'A'),
  cc('hiB', 'EQ Hi B', 'EQ', 0.5, 'B'), cc('midB', 'EQ Mid B', 'EQ', 0.5, 'B'), cc('lowB', 'EQ Low B', 'EQ', 0.5, 'B'),
  cc('filtA', 'Filter A', 'Filter', 0.5, 'A'), cc('filtB', 'Filter B', 'Filter', 0.5, 'B'),
  cc('tempoA', 'Tempo fader A', 'Tempo', 0.5, 'A'), cc('tempoB', 'Tempo fader B', 'Tempo', 0.5, 'B'),
  cc('fxLevel', 'FX level / depth', 'FX', 0),
];

export const GENERIC_PROFILE: Profile = {
  id: 'generic',
  name: 'Generic 2-deck controller',
  input: 'controls',
  controls: GENERIC_CONTROLS,
  capabilities: ['decks:2'],
};
