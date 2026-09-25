import { el } from './dom';

/** Confirmation via <dialog>; resolves true on confirm. */
export function confirmDialog(title: string, body: string, opts: { confirm?: string; cancel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.appendChild(el('h2', {}, title));
    d.appendChild(el('p', { class: 'hint' }, body));
    const row = el('div', { class: 'row', style: 'justify-content:flex-end;margin-top:14px' });
    const cancel = el('button', {}, opts.cancel ?? 'Cancel');
    const ok = el('button', { class: 'primary' }, opts.confirm ?? 'Confirm');
    if (opts.danger) ok.style.background = 'var(--miss)';
    row.append(cancel, ok);
    d.appendChild(row);
    document.body.appendChild(d);
    const done = (v: boolean) => {
      d.close();
      d.remove();
      resolve(v);
    };
    cancel.onclick = () => done(false);
    ok.onclick = () => done(true);
    d.oncancel = () => done(false);
    d.showModal();
    ok.focus();
  });
}
