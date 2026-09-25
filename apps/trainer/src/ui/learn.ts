import { LearnSession, exportMap, importMap, describeMidi, switchKey, type ControlMap, type MidiEvent, type Profile } from '@midi-trainer/engine';
import { $, el, download } from './dom';
import { confirmDialog } from './dialog';
import { toast } from './toast';

export interface LearnUi {
  open(): void;
  close(): void;
  readonly isOpen: boolean;
  /** Feed a MIDI event; returns true if consumed by the learn session. */
  offer(ev: MidiEvent): boolean;
}

/**
 * Learn dialog over a LearnSession. `onChange` fires after every mapping change so the
 * app can persist the map and refresh lane availability.
 */
export function createLearnUi(profile: Profile, map: ControlMap, onChange: (map: ControlMap) => void): LearnUi {
  const modal = $('learn');
  const groups = $('ctlgroups');
  const monitor = $('midiMonitor');
  const session = new LearnSession(profile.controls, map);
  let open = false;
  const recent: string[] = [];

  /** Raw MIDI monitor: last eight messages, newest first, with velocity / value and on/off. */
  function logRaw(ev: MidiEvent): void {
    const owner = Object.entries(map).find(([, e]) => e.key === switchKey(ev) || e.key === ev.key)?.[0];
    recent.unshift(`${describeMidi(ev)}  →  ${switchKey(ev)}${owner ? `  (${profile.controls.find((c) => c.id === owner)?.name ?? owner})` : ''}`);
    if (recent.length > 8) recent.pop();
    monitor.textContent = recent.join('\n');
  }

  function render(): void {
    groups.innerHTML = '';
    const byGroup = new Map<string, typeof profile.controls>();
    for (const c of profile.controls) byGroup.set(c.group, [...(byGroup.get(c.group) ?? []), c]);
    for (const [group, controls] of byGroup) {
      groups.appendChild(el('h3', {}, group));
      const grid = el('div', { class: 'grid' });
      for (const c of controls) {
        const entry = map[c.id];
        const cls = ['ctl', session.current === c.id ? 'arm' : entry ? 'done' : '', entry && !entry.verified ? 'unverified' : ''].filter(Boolean).join(' ');
        const d = el('div', { class: cls, 'data-control': c.id, role: 'button', tabindex: '0' });
        d.appendChild(el('span', {}, c.name));
        const status = session.current === c.id ? (c.kind === 'switch' ? 'move it to this position now' : 'touch it now') : entry ? entry.key + (entry.verified ? '' : ' · unverified') : 'not mapped';
        d.appendChild(el('small', {}, status));
        d.onclick = () => {
          session.arm(c.id);
          render();
        };
        d.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') d.click();
        };
        grid.appendChild(d);
      }
      groups.appendChild(grid);
    }
    const current = groups.querySelector('.ctl.arm');
    current?.scrollIntoView({ block: 'nearest' });
  }

  $('learnBtn').onclick = () => ui.open();
  $('learnDone').onclick = () => ui.close();
  $('learnAll').onclick = () => {
    session.armAll();
    render();
  };
  $('learnSkip').onclick = () => {
    session.skip();
    render();
  };
  $('clearMap').onclick = async () => {
    if (!(await confirmDialog('Clear the whole control map?', 'Every learned control is forgotten. Export first if you want a copy.', { confirm: 'Clear map', danger: true }))) return;
    for (const k of Object.keys(map)) delete map[k];
    session.cancel();
    render();
    onChange(map);
  };
  $('exportMap').onclick = () => download(`${profile.id}-map.json`, JSON.stringify(exportMap(profile.id, map), null, 2));
  $<HTMLInputElement>('importMap').onchange = async (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    try {
      const { profile: p, map: imported } = importMap(JSON.parse(await f.text()));
      if (p && p !== profile.id && !(await confirmDialog('Different profile', `This map is for "${p}". Import into ${profile.name} anyway?`, { confirm: 'Import' }))) return;
      for (const [k, v] of Object.entries(imported)) map[k] = v;
      render();
      onChange(map);
    } catch (err) {
      toast('Could not import map: ' + (err as Error).message, 5000);
    }
    input.value = '';
  };
  modal.onkeydown = (e) => {
    if (e.key === 'Escape') ui.close();
  };

  const ui: LearnUi = {
    open() {
      open = true;
      modal.classList.add('open');
      render();
    },
    close() {
      open = false;
      session.cancel();
      modal.classList.remove('open');
      onChange(map);
    },
    get isOpen() {
      return open;
    },
    offer(ev) {
      if (!open) return false;
      logRaw(ev);
      if (!session.current) return false;
      const mapped = session.offer(ev, `learned ${new Date().toISOString().slice(0, 10)}`);
      if (mapped) {
        render();
        onChange(map);
      }
      return true;
    },
  };
  return ui;
}
