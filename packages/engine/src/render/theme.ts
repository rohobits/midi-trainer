/** Read the theme from CSS custom properties on the document root. */

import { DEFAULT_KEYBOARD_THEME, type KeyboardTheme } from './keyboard';
import { DEFAULT_HIGHWAY_THEME, type HighwayTheme } from './highway';

function cssVars(root: Element): (name: string, fallback: string) => string {
  const cs = getComputedStyle(root);
  return (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
}

/**
 * Highway theme from CSS custom properties (lane accents, judgement colours, fonts). Reads
 * from the `.stage` element when one exists, because the stage re-declares the dark ink and
 * select tokens even in the light theme: the highway is always a dark surface.
 */
export function highwayThemeFromCss(root: Element = document.querySelector('.stage') ?? document.documentElement): HighwayTheme {
  const v = cssVars(root);
  const D = DEFAULT_HIGHWAY_THEME;
  const skin = document.documentElement.dataset.lanes ?? 'classic';
  return {
    noteScale: skin === 'thin' ? 0.7 : skin === 'bold' ? 1.35 : 1,
    deckA: v('--deck-a', D.deckA), deckB: v('--deck-b', D.deckB), mixer: v('--mixer', D.mixer), pads: v('--pads', D.pads), fx: v('--fx', D.fx), select: v('--select', D.select),
    lh: v('--lh', D.lh), rh: v('--rh', D.rh),
    perfect: v('--perfect', D.perfect), great: v('--great', D.great), ok: v('--ok', D.ok), miss: v('--miss', D.miss), early: v('--early', D.early), late: v('--late', D.late),
    ink: v('--ink', D.ink), bg0: D.bg0, bg1: D.bg1, line: D.line, muted: v('--muted', D.muted), euphoria: v('--euphoria', D.euphoria),
    displayFont: v('--display', D.displayFont), monoFont: v('--mono', D.monoFont),
  };
}

export function keyboardThemeFromCss(root: Element = document.querySelector('.stage') ?? document.documentElement): KeyboardTheme {
  const v = cssVars(root);
  const D = DEFAULT_KEYBOARD_THEME;
  return { ...D, rh: v('--rh', D.rh), lh: v('--lh', D.lh), perfect: v('--perfect', D.perfect), great: v('--great', D.great), miss: v('--miss', D.miss), early: v('--early', D.early), late: v('--late', D.late), ok: v('--perfect', D.ok), bad: v('--miss', D.bad) };
}
