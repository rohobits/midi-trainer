import type { ControlMap } from '../../midi/map';

/**
 * Default DDJ-FLX4 map. Deliberately EMPTY until a map exported from a MIDI-learn session
 * on real hardware is committed here (see README, "Export a map"). Never type MIDI numbers
 * from memory; every entry carries `verified` and a `note` saying where it came from.
 */
export const FLX4_DEFAULT_MAP: ControlMap = {};
