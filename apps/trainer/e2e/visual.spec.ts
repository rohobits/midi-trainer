import { test, expect, type Page } from '@playwright/test';

/**
 * Visual regression on frozen frames. `?test=1&t=<beats>&autostart=1` starts the run and
 * freezes the clock at that beat, so the highway renders one deterministic frame. Reduced
 * motion is emulated so no particle or shake state leaks into the capture.
 */
import './hooks';

const MAP = { hcA1: { key: 'n:0:11', verified: true }, playA: { key: 'n:0:12', verified: true }, xf: { key: 'c:0:31', verified: true }, filtA: { key: 'c:0:23', verified: true } };
const SHOT = { maxDiffPixelRatio: 0.04, threshold: 0.3 };

async function frozen(page: Page, drill: string, beats: number): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/#/practice/${drill}?test=1&t=${beats}&autostart=1`);
  await page.waitForFunction(() => window.__frameReady === true);
  await page.evaluate(() => document.fonts.ready);
}

test.use({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });

test('highway: hot cues approaching the strike line', async ({ page }) => {
  await frozen(page, 'hot-cue-drumming', 5.2);
  await expect(page.locator('#cv')).toHaveScreenshot('highway-taps.png', SHOT);
});

test('highway: a filter ramp mid-way', async ({ page }) => {
  await frozen(page, 'cfx-return-to-detent', 9.5);
  await expect(page.locator('#cv')).toHaveScreenshot('highway-ramp.png', SHOT);
});

test('highway: transformer cuts on the crossfader', async ({ page }) => {
  await frozen(page, 'transformer-on-the-crossfader', 6.3);
  await expect(page.locator('#cv')).toHaveScreenshot('highway-cuts.png', SHOT);
});

test('results sheet after a run', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/practice/hot-cue-drumming?test=1');
  await page.waitForFunction(() => !!window.__practice?.run());
  await page.evaluate(() => window.__practice.finish());
  await expect(page.locator('#result')).toHaveClass(/open/);
  await page.waitForTimeout(400);
  await expect(page.locator('#result .sheet')).toHaveScreenshot('results.png', SHOT);
});

test('browse and decks chrome', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/browse?test=1');
  await page.waitForFunction(() => !!window.__trainer && window.__trainer.state().drills > 0);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.tonight')).toHaveScreenshot('tonight.png', { ...SHOT, mask: [page.locator('.tonight .label')] });
  await expect(page.locator('.skillmap').first()).toHaveScreenshot('skillmap.png', SHOT);
  await page.goto('/#/mix?test=1');
  await page.waitForSelector('.console');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.console')).toHaveScreenshot('console.png', SHOT);
});

test('frame time: 200 frames of the densest drill stay under budget', async ({ page }) => {
  await page.goto('/#/practice/transformer-on-the-crossfader?test=1');
  await page.waitForFunction(() => !!window.__practice?.run());
  await page.evaluate((m) => window.__trainer.setMap(m), MAP);
  await page.waitForFunction(() => !!window.__practice?.run());
  const ms = await page.evaluate(() => window.__practice.benchmark(200));
  console.log(`mean draw time ${ms?.toFixed(2)} ms`);
  expect(ms).not.toBeNull();
  // Headless software rendering is several times slower than a GPU; 16 ms here is comfortably 60 fps on hardware.
  expect(ms!).toBeLessThan(16);
});
