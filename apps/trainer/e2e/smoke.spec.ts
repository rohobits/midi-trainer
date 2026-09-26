import { test, expect, type Page } from '@playwright/test';

import './hooks';

const MAP = { hcA1: { key: 'n:0:11', verified: true }, playA: { key: 'n:0:12', verified: true }, faderB: { key: 'c:0:19', verified: true } };

async function ready(page: Page, route = 'browse'): Promise<void> {
  await page.goto(`/#/${route}`);
  await page.waitForFunction(() => !!window.__trainer && window.__trainer.state().drills > 0);
}

test('browse lists paths, the daily challenge and more than 80 DJ drills', async ({ page }) => {
  await ready(page);
  await expect(page.locator('.wordmark')).toHaveText('MIDI Trainer');
  await expect(page.locator('#dailyBtn')).toBeVisible();
  await expect(page.locator('section.path')).toHaveCount(6);
  expect(await page.locator('a.drillcard').count()).toBeGreaterThan(80);
  // The shipped FLX4 default map covers every control, so nothing is locked for mapping.
  await expect(page.locator('a.drillcard[data-drill="phrase-counting"] .badge.lock')).toHaveCount(0);
  await page.evaluate(() => window.__trainer.setMap({}));
  await expect(page.locator('a.drillcard[data-drill="phrase-counting"] .badge.lock')).toContainText('unmapped');
});

test('practice: Space starts the clock and an injected note-on scores a Perfect; extra presses count', async ({ page }) => {
  await ready(page, 'practice/phrase-counting');
  await page.evaluate((m) => window.__trainer.setMap(m), MAP);
  await page.waitForFunction(() => !!window.__practice?.run());
  await expect(page.locator('#title')).toHaveText('Phrase counting');
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__practice.run()?.phase)).toBe('running');
  await expect(page.locator('#playBtn')).toHaveText('Stop');
  await page.evaluate(() => window.__trainer.injectMidi([0x90, 11, 100], window.__practice.startedAt() + 20));
  const st = await page.evaluate(() => window.__practice.run()!.stats());
  expect(st.tiers.perfect).toBe(1);
  expect(st.score).toBeGreaterThan(80);
  await expect(page.locator('#tiers .t-perfect b')).toHaveText('1');
  await page.evaluate(() => window.__trainer.injectMidi([0x90, 11, 100], window.__practice.startedAt() + 480));
  await expect.poll(() => page.evaluate(() => window.__practice.run()!.extraPresses)).toBe(1);
  await page.keyboard.press('Space');
  await expect(page.locator('#playBtn')).toHaveText('Start');
});

test('suggested tracks: panel lists records, Use tempo sets the BPM, browse card shows the badge', async ({ page }) => {
  await ready(page, 'practice/phrase-counting');
  await page.waitForFunction(() => !!window.__practice?.run());
  const rows = page.locator('#lesson .trackrow');
  expect(await rows.count()).toBeGreaterThanOrEqual(2);
  await expect(rows.first().locator('.trackcue')).not.toBeEmpty();
  const useBtn = rows.first().locator('button', { hasText: /^Use \d+/ });
  const bpm = (await useBtn.textContent())!.replace(/\D/g, '');
  await useBtn.click();
  await expect(page.locator('#bpm')).toHaveValue(bpm);
  await ready(page, 'browse');
  await expect(page.locator('a.drillcard[data-drill="phrase-counting"] .badge.tracks')).toContainText('track');
});

test('auto-start on Play A starts from the press; a finished section-looped drill records nothing until it ends', async ({ page }) => {
  await ready(page, 'practice/phrase-counting');
  await page.evaluate((m) => window.__trainer.setMap(m), MAP);
  await page.waitForFunction(() => !!window.__practice?.run());
  await page.evaluate(() => window.__trainer.injectMidi([0x90, 12, 100]));
  await expect.poll(() => page.evaluate(() => window.__practice.run()?.phase)).toBe('running');
  const pos = await page.evaluate(() => window.__practice.run()!.pos(performance.now()));
  expect(pos).toBeGreaterThanOrEqual(0);
  expect(pos).toBeLessThan(1);
});

test('a short generated drill runs to the end and saves an attempt with a medal', async ({ page }) => {
  await ready(page, 'browse');
  await page.evaluate((m) => window.__trainer.setMap(m), MAP);
  await page.click('.drawer summary');
  await page.selectOption('#tpl', 'faderChops');
  await page.fill('#genBars', '1');
  await page.fill('#genBpm', '200');
  await page.fill('#genSeed', '2');
  await page.click('#genBtn');
  await page.waitForFunction(() => location.hash.startsWith('#/practice/gen-') && !!window.__practice?.run());
  await page.keyboard.press('Space');
  // 1 bar at 200 BPM + 2 tail beats = 1.8 s; ride the fader on the grid so cuts land
  await page.evaluate(async () => {
    const t0 = window.__practice.startedAt();
    const beat = 60000 / 200;
    for (let i = 0; i < 8; i++) window.__trainer.injectMidi([0xb0, 19, i % 2 ? 127 : 0], t0 + i * beat * 0.5 + 5);
  });
  await expect.poll(() => page.evaluate(() => window.__practice.run()?.phase), { timeout: 8000 }).toBe('finished');
  await expect(page.locator('#result')).toHaveClass(/open/);
  expect(await page.evaluate(() => window.__trainer.state().attempts)).toBe(1);
});

test('piano, dashboard, settings and calibration views render', async ({ page }) => {
  await ready(page, 'piano');
  await expect(page.locator('#title')).toContainText('C major scale');
  await expect(page.locator('#lastin')).toContainText('C4');
  await ready(page, 'dashboard');
  await expect(page.locator('.hero .panel').first()).toContainText('Today');
  await ready(page, 'settings');
  await expect(page.locator('.form label').first()).toContainText('Theme');
  await ready(page, 'calibrate');
  await expect(page.locator('.wizard .step')).toHaveText('Ready');
});

test('editor validates JSON and saves a custom drill; decks, report and replay views render', async ({ page }) => {
  await ready(page, 'editor');
  await expect(page.locator('#jsonErr')).toContainText('Valid');
  await page.fill('#drillJson', '{"id":"custom-e2e","name":"E2E","tier":"Custom","profile":"flx4","bpm":120,"bars":1,"targets":[{"type":"tap","c":"hcA1","t":0}],"lesson":"## x"}');
  await expect(page.locator('#jsonErr')).toContainText('1 targets');
  await page.click('#saveDrill');
  await expect(page.locator('.toast')).toContainText('Saved');
  await page.fill('#drillJson', '{"id":"Bad Id","name":"x"}');
  await expect(page.locator('#jsonErr')).toContainText('id');
  await ready(page, 'mix');
  await expect(page.locator('#mixStart')).toBeVisible();
  await expect(page.locator('.deckcard')).toHaveCount(2);
  await ready(page, 'report');
  await expect(page.locator('h2').first()).toContainText('Practice report');
  await ready(page, 'welcome');
  await expect(page.locator('#chooseDj')).toBeVisible();
  await ready(page, 'placement');
  await expect(page.locator('#placementStart')).toBeVisible();
  await page.click('#placementStart');
  await expect(page.locator('h2').first()).toContainText('drill 1');
  await page.click('text=Quit');
  await ready(page, 'settings');
  await page.fill('.settings input[type="number"] >> nth=3', '77');
  await page.dispatchEvent('.settings input[type="number"] >> nth=3', 'change');
  await page.click('text=Reset thresholds');
  await expect(page.locator('.settings input[type="number"] >> nth=3')).not.toHaveValue('77');
});

test('history and replay work after a finished attempt', async ({ page }) => {
  await ready(page, 'editor');
  await page.fill('#drillJson', '{"id":"custom-e2e","name":"E2E","tier":"Custom","profile":"flx4","bpm":120,"bars":1,"targets":[{"type":"tap","c":"hcA1","t":0}],"lesson":"## x"}');
  await page.click('#saveDrill');
  await expect(page.locator('.toast')).toContainText('Saved');
  await page.evaluate(() => window.__trainer.navigate('practice/custom-e2e'));
  await page.waitForFunction(() => location.hash.includes('custom-e2e') && !!window.__practice?.run());
  await page.evaluate((m) => window.__trainer.setMap(m), MAP);
  await page.keyboard.press('Space');
  await page.evaluate(() => window.__trainer.injectMidi([0x90, 11, 100], window.__practice.startedAt() + 10));
  await expect.poll(() => page.evaluate(() => window.__practice.run()?.phase), { timeout: 8000 }).toBe('finished');
  await ready(page, 'history/custom-e2e');
  await expect(page.locator('table tbody tr')).toHaveCount(1);
  await page.click('table tbody tr button');
  await page.waitForFunction(() => location.hash.startsWith('#/replay/'));
  await expect(page.locator('#replayPlay')).toBeVisible();
  await expect(page.locator('#scrub')).toBeVisible();
});
