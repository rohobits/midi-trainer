/** Toast via the Popover API (top layer, no z-index fights). Falls back to a plain element. */
let el: HTMLElement | null = null;
let timer = 0;

export function toast(text: string, ms = 2200): void {
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('popover', 'manual');
    document.body.appendChild(el);
  }
  el.textContent = text;
  const p = el as HTMLElement & { showPopover?: () => void; hidePopover?: () => void };
  try {
    if (p.showPopover && !el.matches(':popover-open')) p.showPopover();
    else if (!p.showPopover) el.style.display = 'block';
  } catch {
    el.style.display = 'block';
  }
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    try {
      if (p.hidePopover) p.hidePopover();
      else el!.style.display = 'none';
    } catch {
      el!.style.display = 'none';
    }
  }, ms);
}
