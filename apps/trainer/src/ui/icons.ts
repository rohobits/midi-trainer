import { createElement } from 'lucide';
import Play from 'lucide/dist/esm/icons/play.mjs';
import Square from 'lucide/dist/esm/icons/square.mjs';
import RotateCcw from 'lucide/dist/esm/icons/rotate-ccw.mjs';
import ChevronLeft from 'lucide/dist/esm/icons/chevron-left.mjs';
import ChevronRight from 'lucide/dist/esm/icons/chevron-right.mjs';
import Lock from 'lucide/dist/esm/icons/lock.mjs';
import Music from 'lucide/dist/esm/icons/music.mjs';
import Disc from 'lucide/dist/esm/icons/disc-3.mjs';
import Piano from 'lucide/dist/esm/icons/piano.mjs';
import Settings from 'lucide/dist/esm/icons/settings.mjs';
import Zap from 'lucide/dist/esm/icons/zap.mjs';
import Check from 'lucide/dist/esm/icons/check.mjs';
import Flame from 'lucide/dist/esm/icons/flame.mjs';
import Trophy from 'lucide/dist/esm/icons/trophy.mjs';
import Usb from 'lucide/dist/esm/icons/usb.mjs';
import Volume from 'lucide/dist/esm/icons/volume-2.mjs';
import VolumeOff from 'lucide/dist/esm/icons/volume-x.mjs';
import Sliders from 'lucide/dist/esm/icons/sliders-horizontal.mjs';
import Layers from 'lucide/dist/esm/icons/layers.mjs';
import Grid from 'lucide/dist/esm/icons/layout-grid.mjs';
import Pencil from 'lucide/dist/esm/icons/pencil.mjs';
import ChartLine from 'lucide/dist/esm/icons/chart-line.mjs';

const ICONS = { play: Play, stop: Square, restart: RotateCcw, prev: ChevronLeft, next: ChevronRight, lock: Lock, music: Music, disc: Disc, piano: Piano, settings: Settings, zap: Zap, check: Check, flame: Flame, trophy: Trophy, usb: Usb, volume: Volume, volumeOff: VolumeOff, sliders: Sliders, layers: Layers, grid: Grid, pencil: Pencil, chart: ChartLine };
export type IconName = keyof typeof ICONS;

export function icon(name: IconName, size = 16): SVGElement {
  const svg = createElement(ICONS[name] as never, { width: size, height: size, 'stroke-width': 2, 'aria-hidden': 'true' });
  svg.style.verticalAlign = '-3px';
  return svg;
}
