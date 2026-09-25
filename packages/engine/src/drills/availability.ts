import type { Drill } from './schema';
import { controlsFor } from './lanes';

export type UnavailableReason =
  | { kind: 'unmapped'; controls: string[] }
  | { kind: 'needsAudio' }
  | { kind: 'requires'; hardware: string[] };

export interface Availability {
  available: boolean;
  reasons: UnavailableReason[];
}

/**
 * Why a drill can't be run right now. `mapped` is the set of control ids with a MIDI
 * mapping; `capabilities` lists hardware the current setup provides (e.g. 'decks:4').
 * Piano drills (note targets only) need no mapping.
 */
export function availability(
  drill: Drill,
  mapped: ReadonlySet<string>,
  opts: { hasAudio?: boolean; capabilities?: ReadonlySet<string> } = {},
): Availability {
  const reasons: UnavailableReason[] = [];
  const unmapped = controlsFor(drill).filter((c) => !mapped.has(c));
  if (unmapped.length) reasons.push({ kind: 'unmapped', controls: unmapped });
  if (drill.needsAudio && !opts.hasAudio) reasons.push({ kind: 'needsAudio' });
  const caps = opts.capabilities ?? new Set<string>();
  const missing = (drill.requires ?? []).filter((r) => !caps.has(r));
  if (missing.length) reasons.push({ kind: 'requires', hardware: missing });
  return { available: reasons.length === 0, reasons };
}
