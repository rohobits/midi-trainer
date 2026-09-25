export interface Theme {
  tap: string;
  ramp: string;
  ok: string;
  bad: string;
  early: string;
  late: string;
  muted: string;
  ink: string;
  line: string;
  lane: string;
  font: string;
}

/** Read the theme from CSS custom properties on the document root. */
export function themeFromCss(root: Element = document.documentElement): Theme {
  const cs = getComputedStyle(root);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    tap: v('--tap'),
    ramp: v('--ramp'),
    ok: v('--ok'),
    bad: v('--bad'),
    early: v('--early') || v('--tap'),
    late: v('--late') || v('--ramp'),
    muted: v('--muted'),
    ink: v('--ink'),
    line: v('--line'),
    lane: v('--lane'),
    font: v('--font'),
  };
}

import type { KeyboardTheme } from './keyboard';

export function keyboardThemeFromCss(root: Element = document.documentElement): KeyboardTheme {
  const cs = getComputedStyle(root);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    ...themeFromCss(root),
    ivory: v('--ivory') || '#FBF8F0',
    ebony: v('--ebony') || '#231F1B',
    keyline: v('--keyline') || v('--line'),
    rh: v('--rh') || v('--tap'),
    lh: v('--lh') || v('--ramp'),
  };
}
