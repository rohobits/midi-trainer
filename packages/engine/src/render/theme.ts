/** Read the theme from CSS custom properties on the document root. */

import { DEFAULT_KEYBOARD_THEME, type KeyboardTheme } from './keyboard';
import { DEFAULT_HIGHWAY_THEME, type HighwayTheme } from './highway';

function cssVars(root: Element): (name: string, fallback: string) => string {
  const cs = getComputedStyle(root);
  return (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
}

/** Highway theme from CSS custom properties (lane accents, judgement colours, fonts). */
export function highwayThemeFromCss(root: Element = document.documentElement): HighwayTheme {
  const v = cssVars(root);
  const D = DEFAULT_HIGHWAY_THEME;
  return {
    deckA: v('--deck-a', D.deckA), deckB: v('--deck-b', D.deckB), mixer: v('--mixer', D.mixer), pads: v('--pads', D.pads), fx: v('--fx', D.fx), select: v('--select', D.select),
    lh: v('--lh', D.lh), rh: v('--rh', D.rh),
    perfect: v('--perfect', D.perfect), great: v('--great', D.great), ok: v('--ok', D.ok), miss: v('--miss', D.miss), early: v('--early', D.early), late: v('--late', D.late),
    ink: '#f3f1ea', bg0: D.bg0, bg1: D.bg1, line: D.line, muted: D.muted, euphoria: v('--euphoria', D.euphoria),
    displayFont: D.displayFont, monoFont: D.monoFont,
  };
}

export function keyboardThemeFromCss(root: Element = document.documentElement): KeyboardTheme {
  const v = cssVars(root);
  const D = DEFAULT_KEYBOARD_THEME;
  return { ...D, rh: v('--rh', D.rh), lh: v('--lh', D.lh), perfect: v('--perfect', D.perfect), great: v('--great', D.great), miss: v('--miss', D.miss), early: v('--early', D.early), late: v('--late', D.late), ok: v('--perfect', D.ok), bad: v('--miss', D.bad) };
}
