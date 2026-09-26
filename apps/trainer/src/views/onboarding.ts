import type { View } from '../router';
import { navigate } from '../router';
import { el } from '../ui/dom';
import { icon } from '../ui/icons';

/**
 * First run: pick an instrument, connect MIDI, calibrate, first drill. Skippable; re-run
 * from Settings. Each step is one panel; progress is the bar at the top.
 */
export const onboardingView: View = (root, app, params) => {
  let step = Number(params.query.get('step') ?? 1);
  const wrap = el('div', { class: 'onboard' });
  root.appendChild(wrap);
  const offs: Array<() => void> = [];

  const flx4Svg = `<svg viewBox="0 0 320 140" fill="none" stroke="var(--deck-a)" stroke-width="1.5"><rect x="4" y="6" width="312" height="128" rx="8" stroke="var(--line-strong)"/><circle cx="70" cy="60" r="34"/><circle cx="250" cy="60" r="34" stroke="var(--deck-b)"/><g stroke="var(--pads)"><rect x="34" y="104" width="14" height="10" rx="2"/><rect x="52" y="104" width="14" height="10" rx="2"/><rect x="70" y="104" width="14" height="10" rx="2"/><rect x="88" y="104" width="14" height="10" rx="2"/></g><g stroke="var(--pads)"><rect x="214" y="104" width="14" height="10" rx="2"/><rect x="232" y="104" width="14" height="10" rx="2"/><rect x="250" y="104" width="14" height="10" rx="2"/><rect x="268" y="104" width="14" height="10" rx="2"/></g><g stroke="var(--mixer)"><rect x="132" y="30" width="6" height="70" rx="3"/><rect x="182" y="30" width="6" height="70" rx="3"/><rect x="140" y="112" width="40" height="6" rx="3"/></g><g stroke="var(--fx)"><circle cx="160" cy="24" r="6"/><circle cx="145" cy="46" r="5"/><circle cx="175" cy="46" r="5"/></g></svg>`;
  const pianoSvg = `<svg viewBox="0 0 320 140" fill="none"><rect x="4" y="6" width="312" height="128" rx="8" stroke="var(--line-strong)" stroke-width="1.5"/>${Array.from({ length: 14 }, (_, i) => `<rect x="${12 + i * 21}" y="40" width="20" height="84" rx="2" fill="var(--ivory)"/>`).join('')}${[0, 1, 3, 4, 5, 7, 8, 10, 11, 12].map((i) => `<rect x="${26 + i * 21}" y="40" width="12" height="52" rx="2" fill="var(--ebony)"/>`).join('')}<rect x="12" y="16" width="296" height="14" rx="3" fill="var(--s2)"/><circle cx="24" cy="23" r="3" fill="var(--deck-b)"/></svg>`;

  function render(): void {
    wrap.innerHTML = '';
    const steps = el('div', { class: 'steps' });
    for (let i = 1; i <= 4; i++) steps.appendChild(el('i', { class: i <= step ? 'on' : '' }));
    wrap.appendChild(steps);
    const panel = el('div', { class: 'panel' });
    wrap.appendChild(panel);
    if (step === 1) {
      panel.appendChild(el('h1', {}, 'What are you practising?'));
      panel.appendChild(el('p', { class: 'hint' }, 'You can switch any time from the profile menu in the top bar.'));
      const choice = el('div', { class: 'choice', style: 'margin-top:16px' });
      const dj = el('button', { id: 'chooseDj' });
      dj.innerHTML = flx4Svg + '<b>DJ controller</b><span class="hint">Pioneer DDJ-FLX4 with the shipped map, or any MIDI controller via learn.</span>';
      dj.onclick = () => {
        if (app.profile.id !== 'flx4') {
          const sel = document.getElementById('profile') as HTMLSelectElement | null;
          if (sel) sel.value = 'flx4';
          void app.setProfile('flx4');
        }
        go(2, { lastProfile: 'flx4' });
      };
      const piano = el('button', { id: 'choosePiano' });
      piano.innerHTML = pianoSvg + '<b>Piano</b><span class="hint">Any 88-key MIDI keyboard. Falling notes, wait mode, .mid files.</span>';
      piano.onclick = () => go(2, { lastProfile: 'flx4', onboarded: true }, 'piano');
      choice.append(dj, piano);
      panel.appendChild(choice);
    } else if (step === 2) {
      panel.appendChild(el('h1', {}, 'Connect your controller'));
      panel.appendChild(el('p', { class: 'hint' }, 'Plug in over USB, allow MIDI when the browser asks, then press any pad. rekordbox can stay open.'));
      const chip = el('div', { class: 'device', style: 'margin:16px 0;max-width:none;font-size:14px' });
      const led = el('span', { class: 'led', id: 'obLed' });
      const name = el('span', { id: 'obName' }, 'Waiting for a device…');
      chip.append(led, name);
      panel.appendChild(chip);
      const test = el('div', { class: 'panel', style: 'background:var(--s0);margin:10px 0' });
      test.innerHTML = '<div class="label">Press any pad</div><div class="mono" id="obLast" style="font-size:18px;margin-top:6px">…</div>';
      panel.appendChild(test);
      const row = el('div', { class: 'row', style: 'margin-top:14px' });
      const connect = el('button', { class: 'primary' }, 'Connect');
      connect.onclick = () => (document.getElementById('midiBtn') as HTMLButtonElement)?.click();
      const map = el('button', {}, 'Map controls');
      map.onclick = () => app.learn?.open();
      const next = el('button', { id: 'obNext' }, 'Next');
      next.onclick = () => go(3);
      const skip = el('button', { class: 'ghost' }, 'Skip setup');
      skip.onclick = () => finish();
      row.append(connect, map, next, skip);
      panel.appendChild(row);
      const refresh = () => {
        const on = !!app.deviceName;
        led.classList.toggle('on', on);
        name.textContent = on ? app.deviceName : 'Waiting for a device…';
      };
      refresh();
      offs.push(app.on('midi', ({ ev, mapped }) => {
        const last = document.getElementById('obLast');
        if (last) last.textContent = `${mapped ? app.controlName(mapped) : 'unmapped'} · ${ev.key}`;
        refresh();
      }));
      const iv = window.setInterval(refresh, 800);
      offs.push(() => clearInterval(iv));
    } else if (step === 3) {
      panel.appendChild(el('h1', {}, 'Calibrate your timing'));
      panel.appendChild(el('p', { class: 'hint' }, 'Sixteen clicks; tap a pad on each. The median of your early/late bias becomes the input offset, so judging is honest for your hands and your hardware.'));
      const row = el('div', { class: 'row', style: 'margin-top:14px' });
      const cal = el('button', { class: 'primary', id: 'obCalibrate' }, 'Run calibration');
      cal.onclick = () => navigate('calibrate?onboard=1');
      const skip = el('button', {}, 'Later');
      skip.onclick = () => go(4);
      row.append(cal, skip);
      panel.appendChild(row);
    } else {
      panel.appendChild(el('h1', {}, 'Your first drill'));
      panel.appendChild(el('p', { class: 'hint' }, 'Phrase counting: tap hot cue A1 on the first beat of every 8-bar phrase. Everything else builds on feeling that boundary without looking.'));
      const row = el('div', { class: 'row', style: 'margin-top:14px' });
      const go1 = el('button', { class: 'primary', id: 'obStart' }, 'Start Phrase counting');
      go1.onclick = () => finish('practice/phrase-counting');
      const browse = el('button', {}, 'Browse all drills');
      browse.onclick = () => finish('browse');
      row.append(go1, browse);
      panel.appendChild(row);
    }
    const foot = el('p', { class: 'hint', style: 'margin-top:12px' });
    foot.appendChild(icon('usb', 14));
    foot.appendChild(document.createTextNode(' Everything stays in this browser. No account, no upload.'));
    wrap.appendChild(foot);
  }

  function go(n: number, patch: Partial<typeof app.settings> = {}, route?: string): void {
    if (Object.keys(patch).length) void app.saveSettings(patch);
    if (route) {
      finish(route);
      return;
    }
    step = n;
    location.hash = `#/welcome?step=${n}`;
    render();
  }

  function finish(route = 'browse'): void {
    void app.saveSettings({ onboarded: true }).then(() => navigate(route));
  }

  render();
  return () => offs.forEach((f) => f());
};
