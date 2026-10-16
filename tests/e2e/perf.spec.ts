import { expect, test } from '@playwright/test';
import { completeOnboarding, launchApp } from './harness';

/**
 * Budgets are generous (CI machines and virtual displays are slow); the measured
 * numbers are printed so regressions are visible long before a budget fails.
 */
test('cold start and the 604-page mushaf stay fast', async () => {
  const first = await launchApp();
  await completeOnboarding(first.page);
  await first.app.close();

  const started = Date.now();
  const { app, page } = await launchApp({ userData: first.userData });
  await page.getByRole('heading', { name: '15 October' }).waitFor();
  await page.getByRole('region', { name: 'Today’s focus' }).getByRole('listitem').first().waitFor();
  const coldStart = Date.now() - started;

  const before = Date.now();
  await page.evaluate(() => {
    window.location.hash = '#/quran/mushaf';
  });
  await expect(page.getByRole('gridcell')).toHaveCount(604);
  const mushaf = Date.now() - before;

  const nav = Date.now();
  await page.evaluate(() => {
    window.location.hash = '#/planner';
  });
  await page.getByRole('heading', { name: /^Week of/ }).waitFor();
  const planner = Date.now() - nav;

  console.info(
    `[perf] cold start to Today with actions: ${coldStart} ms · mushaf (604 cells): ${mushaf} ms · planner: ${planner} ms`,
  );
  expect(coldStart).toBeLessThan(6000);
  expect(mushaf).toBeLessThan(2500);
  expect(planner).toBeLessThan(2500);
  await app.close();
});
