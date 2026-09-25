import type { App } from './app';

export interface RouteParams {
  path: string;
  id?: string;
  query: URLSearchParams;
}

export type View = (root: HTMLElement, app: App, params: RouteParams) => (() => void) | void;

/** Tiny hash router: `#/name/id?query`. */
export class Router {
  private routes = new Map<string, View>();
  private unmount: (() => void) | void = undefined;
  current = '';

  constructor(
    private root: HTMLElement,
    private app: App,
  ) {}

  add(name: string, view: View): this {
    this.routes.set(name, view);
    return this;
  }

  start(defaultRoute = 'browse'): void {
    const go = () => {
      const hash = location.hash.replace(/^#\/?/, '');
      const [pathPart, queryPart] = hash.split('?');
      const [name, ...rest] = (pathPart || defaultRoute).split('/');
      const view = this.routes.get(name!) ?? this.routes.get(defaultRoute)!;
      this.unmount?.();
      this.root.innerHTML = '';
      this.current = name!;
      document.querySelectorAll<HTMLAnchorElement>('nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === name));
      window.scrollTo(0, 0);
      this.unmount = view(this.root, this.app, { path: name!, id: rest.length ? decodeURIComponent(rest.join('/')) : undefined, query: new URLSearchParams(queryPart ?? '') });
    };
    window.addEventListener('hashchange', go);
    go();
  }
}

export function navigate(to: string): void {
  location.hash = to.startsWith('#') ? to : `#/${to}`;
}
