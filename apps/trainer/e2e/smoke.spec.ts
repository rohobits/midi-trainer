import { test, expect, type Page } from '@playwright/test';

interface Hook {
  injectMidi(bytes: number[], timeStamp?: number): void;
  setMap(map: Record<string, { key: string; verified: boolean }>): void;
  selectDrill(id: string): void;
  start(): void;
  now(): number;
  startedAt(): number;
  state(): { drill: string | null; phase: string | null; pos: number | null; stats: { score: number | null; tiers: Record<string, number> } | null; extra: number; drills: number; lanes: string[] };
}

declare global {
  interface Window {
    __trainer: Hook;
  }
}

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => window.__trainer && window.__trainer.state().drill !== null);
}

test('loads the built-in drills grouped by tier', async ({ page }) => {
  await ready(page);
  await expect(page.locator('h1')).toHaveText('MIDI Trainer');
  const groups = page.locator('#drill optgroup');
  await expect(groups).toHaveCount(4);
  await expect(groups.nth(0)).toHaveAttribute('label', 'Foundations');
  await expect(page.locator('#drill option')).toHaveCount(13);
  expect(await page.evaluate(() => window.__trainer.state().drills)).toBe(18);
  await expect(page.locator('#lesson h2')).toContainText('Count in phrases');
});

test('unmapped lanes mark drills unavailable; mapping fixes it', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#drill option[value="phrase-counting"]')).toContainText('unmapped: hcA1');
  await page.evaluate(() => window.__trainer.setMap({ hcA1: { key: 'n:0:11', verified: true }, playA: { key: 'n:0:12', verified: true } }));
  await expect(page.locator('#drill option[value="phrase-counting"]')).toHaveText('Phrase counting');
});

test('Space starts the clock and an injected note-on on a mapped pad scores a Perfect', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    window.__trainer.setMap({ hcA1: { key: 'n:0:11', verified: true }, playA: { key: 'n:0:12', verified: true } });
    window.__trainer.selectDrill('phrase-counting');
  });
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__trainer.state().phase)).toBe('running');
  await expect(page.locator('#playBtn')).toHaveText('Stop');
  // The first target is at beat 0; stamp the pad 20 ms after the start so timing is deterministic.
  await page.evaluate(() => window.__trainer.injectMidi([0x90, 11, 100], window.__trainer.startedAt() + 20));
  const st = await page.evaluate(() => window.__trainer.state());
  expect(st.stats?.tiers.perfect).toBe(1);
  expect(st.stats?.score).toBeGreaterThan(80);
  await expect(page.locator('#tiers .t-perfect b')).toHaveText('1');
  // A press with no target nearby (beat 1 at 125 BPM = 480 ms) is an extra, not a miss.
  await page.evaluate(() => window.__trainer.injectMidi([0x90, 11, 100], window.__trainer.startedAt() + 480));
  await expect.poll(() => page.evaluate(() => window.__trainer.state().extra)).toBe(1);
  await page.keyboard.press('Space');
  await expect(page.locator('#playBtn')).toHaveText('Start');
});

test('auto-start on Play A starts the clock from the press', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    window.__trainer.setMap({ hcA1: { key: 'n:0:11', verified: true }, playA: { key: 'n:0:12', verified: true } });
    window.__trainer.selectDrill('phrase-counting');
    window.__trainer.injectMidi([0x90, 12, 100]);
  });
  await expect.poll(() => page.evaluate(() => window.__trainer.state().phase)).toBe('running');
  const pos = await page.evaluate(() => window.__trainer.state().pos);
  expect(pos).toBeGreaterThanOrEqual(0);
  expect(pos).toBeLessThan(1);
});
