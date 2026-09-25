import type { App } from '../app';
import { el } from './dom';

/**
 * On-screen controller: pads, faders, knobs and jogs for the current profile, so drills can
 * be tried without hardware. Emits control events straight into the app (bypasses the map).
 */
export function createController(app: App, host: HTMLElement, opts: { compact?: boolean } = {}): () => void {
  const wrap = el('div', { class: 'controller' });
  host.appendChild(wrap);
  const groups = new Map<string, typeof app.profile.controls>();
  for (const c of app.profile.controls) {
    if (opts.compact && (c.group.startsWith('Pads ·') && !c.group.includes('HOT CUE'))) continue;
    if (opts.compact && c.group === 'Browse') continue;
    const key = c.deck ? `${c.deck} · ${c.group}` : c.group;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  for (const [name, controls] of groups) {
    const deck = el('div', { class: 'deck' });
    deck.appendChild(el('h3', {}, name));
    const pads = el('div', { class: 'pads' });
    const knobs = el('div', { class: 'knobs' });
    for (const c of controls) {
      if (c.kind === 'tap') {
        const b = el('button', { type: 'button', 'data-control': c.id, title: c.name }, c.name.replace(/ [AB]\d?$/, '').slice(0, 10));
        b.onpointerdown = (e) => {
          e.preventDefault();
          app.sounds.ensure();
          app.virtual({ kind: 'tap', c: c.id, timeStamp: performance.now() });
        };
        b.onpointerup = () => app.virtual({ kind: 'release', c: c.id, timeStamp: performance.now() });
        pads.appendChild(b);
      } else if (c.kind === 'cc') {
        const label = el('label', {}, c.name.replace(/ [AB]$/, ''));
        const input = el('input', { type: 'range', min: '0', max: '1000', value: String(Math.round((app.values[c.id] ?? c.defaultValue ?? 0) * 1000)), 'data-control': c.id });
        input.oninput = () => app.virtual({ kind: 'cc', c: c.id, value: Number(input.value) / 1000, timeStamp: performance.now() });
        label.appendChild(input);
        knobs.appendChild(label);
      } else {
        const jog = el('div', { class: 'jog', 'data-control': c.id }, c.name);
        let lastAngle: number | null = null;
        jog.onpointerdown = (e) => {
          jog.setPointerCapture(e.pointerId);
          lastAngle = angle(e, jog);
          app.virtual({ kind: 'tap', c: c.id.replace('jog', 'jogTouch'), timeStamp: performance.now() });
        };
        jog.onpointermove = (e) => {
          if (lastAngle == null) return;
          const a = angle(e, jog);
          let d = a - lastAngle;
          if (d > Math.PI) d -= 2 * Math.PI;
          if (d < -Math.PI) d += 2 * Math.PI;
          lastAngle = a;
          const ticks = Math.round(d * 12);
          if (ticks) app.virtual({ kind: 'rel', c: c.id, delta: ticks, timeStamp: performance.now() });
        };
        jog.onpointerup = () => {
          lastAngle = null;
          app.virtual({ kind: 'release', c: c.id.replace('jog', 'jogTouch'), timeStamp: performance.now() });
        };
        knobs.appendChild(jog);
      }
    }
    if (pads.children.length) deck.appendChild(pads);
    if (knobs.children.length) deck.appendChild(knobs);
    wrap.appendChild(deck);
  }
  const off = app.on('control', (ev) => {
    if (ev.kind === 'cc') {
      const input = wrap.querySelector<HTMLInputElement>(`input[data-control="${ev.c}"]`);
      if (input && document.activeElement !== input) input.value = String(Math.round(ev.value * 1000));
    }
  });
  return () => {
    off();
    wrap.remove();
  };
}

function angle(e: PointerEvent, elx: HTMLElement): number {
  const r = elx.getBoundingClientRect();
  return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
}
