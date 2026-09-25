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
import { $ } from './ui/dom';

const app = new App();

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
    .add('report', reportView);
  router.start('browse');
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
    state: () => ({
      route: router.current,
      drills: app.drills.length,
      attempts: app.attempts.length,
      settings: app.settings,
      profile: app.profile.id,
    }),
  };
}

void boot();
