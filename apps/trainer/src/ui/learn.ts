import { LearnSession, exportMap, importMap, type ControlMap, type MidiEvent, type Profile } from '@midi-trainer/engine';
import { $, el, download } from './dom';

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
  const session = new LearnSession(profile.controls, map);
  let open = false;

  function render(): void {
    groups.innerHTML = '';
    const byGroup = new Map<string, typeof profile.controls>();
    for (const c of profile.controls) {
      const list = byGroup.get(c.group) ?? [];
      byGroup.set(c.group, [...list, c]);
    }
    for (const [group, controls] of byGroup) {
      groups.appendChild(el('h3', {}, group));
      const grid = el('div', { class: 'grid' });
      for (const c of controls) {
        const entry = map[c.id];
        const cls = ['ctl', session.current === c.id ? 'arm' : entry ? 'done' : '', entry && !entry.verified ? 'unverified' : ''].filter(Boolean).join(' ');
        const d = el('div', { class: cls, 'data-control': c.id });
        d.appendChild(el('span', {}, c.name));
        const status = session.current === c.id ? 'touch it now' : entry ? entry.key + (entry.verified ? '' : ' · unverified') : 'not mapped';
        d.appendChild(el('small', {}, status));
        d.onclick = () => {
          session.arm(c.id);
          render();
        };
        grid.appendChild(d);
      }
      groups.appendChild(grid);
    }
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
  $('clearMap').onclick = () => {
    if (!confirm('Clear the whole control map?')) return;
    for (const k of Object.keys(map)) delete map[k];
    session.cancel();
    render();
    onChange(map);
  };
  $('exportMap').onclick = () => {
    download(`${profile.id}-map.json`, JSON.stringify(exportMap(profile.id, map), null, 2));
  };
  $<HTMLInputElement>('importMap').onchange = async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const { profile: p, map: imported } = importMap(JSON.parse(await f.text()));
      if (p && p !== profile.id && !confirm(`This map is for profile "${p}". Import into ${profile.name} anyway?`)) return;
      for (const [k, v] of Object.entries(imported)) map[k] = v;
      render();
      onChange(map);
    } catch (err) {
      alert('Could not import map: ' + (err as Error).message);
    }
    (e.target as HTMLInputElement).value = '';
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
      if (!open || !session.current) return false;
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
