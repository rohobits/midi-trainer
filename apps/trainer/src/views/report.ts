import type { View } from '../router';
import { el } from '../ui/dom';

export const reportView: View = (root) => {
  root.appendChild(el('p', { class: 'hint' }, 'Coming up in this build.'));
};
