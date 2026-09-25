import { App } from './app';
import { Router } from './router';
import { practiceView } from './views/practice';
import { pianoView } from './views/piano';
import { browseView } from './views/browse';
import { historyView } from './views/history';
import { replayView } from './views/replay';
import { dashboardView } from './views/dashboard';
import { settingsView } from './views/settings';
import { calibrateView } from './views/calibrate';
import { placementView } from './views/placement';
import { mixView } from './views/mix';
import { editorView } from './views/editor';
import { reportView } from './views/report';
import { onboardingView } from './views/onboarding';
import { $ } from './ui/dom';

const app = new App();

const ACCENT: Record<string, string> = { browse: 'var(--deck-a)', practice: 'var(--deck-a)', piano: 'var(--deck-b)', mix: 'var(--mixer)', dashboard: 'var(--pads)', editor: 'var(--fx)', settings: 'var(--select)', history: 'var(--pads)', replay: 'var(--pads)', report: 'var(--pads)', calibrate: 'var(--select)', placement: 'var(--deck-a)', welcome: 'var(--deck-a)' };

async function boot(): Promise<void> {
  await app.boot();
  const router = new Router($('view'), app)
    .add('browse', browseView)
    .add('practice', practiceView)
    .add('piano', pianoView)
    .add('history', historyView)
    .add('replay', replayView)
    .add('dashboard', dashboardView)
    .add('settings', settingsView)
    .add('calibrate', calibrateView)
    .add('placement', placementView)
    .add('mix', mixView)
    .add('editor', editorView)
    .add('report', reportView)
    .add('welcome', onboardingView);
  router.onRoute = (name) => {
    document.documentElement.style.setProperty('--accent', ACCENT[name] ?? 'var(--deck-a)');
  };
  // First run lands on onboarding; a direct link to any page (or test mode) skips it.
  const firstRun = !app.settings.onboarded && !location.hash.includes('test=1');
  if (firstRun && (location.hash === '' || location.hash === '#/' || location.hash === '#')) location.hash = '#/welcome';
  router.start('browse');
  document.addEventListener('pointerdown', () => app.unlockAudio(), { once: true });
  (window as unknown as { __trainer: unknown }).__trainer = {
    app,
    injectMidi: (bytes: number[], timeStamp?: number) => app.midi.inject(bytes, timeStamp ?? performance.now()),
    setMap: (map: Record<string, { key: string; verified: boolean }>) => {
      for (const k of Object.keys(app.map)) delete app.map[k];
      Object.assign(app.map, map);
      app.rev = Object.fromEntries(Object.entries(map).map(([c, e]) => [e.key, c]));
      app.learn?.close();
    },
    navigate: (to: string) => {
      location.hash = `#/${to}`;
    },
    state: () => ({ route: router.current, drills: app.drills.length, attempts: app.attempts.length, settings: app.settings, profile: app.profile.id }),
  };
}

void boot();
