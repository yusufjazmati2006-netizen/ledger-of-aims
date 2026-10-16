import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { completeOnboarding, launchApp, networkLog } from './harness';

function testImage(path: string, hue: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="${hue}"/><circle cx="150" cy="140" r="60" fill="#fff"/></svg>`;
  writeFileSync(path, new Resvg(svg).render().asPng());
  return path;
}

test('Physique: weigh-in with undo, training with PRs, nutrition, meal prep and photos', async () => {
  const { app, page, userData } = await launchApp();
  await completeOnboarding(page, '66.4');
  await page.getByRole('link', { name: 'Physique' }).click();

  // Weigh-in, then undo it.
  await page.getByLabel('Weight in kg').fill('66.9');
  await page.getByRole('button', { name: 'Log weight' }).click();
  await expect(page.getByText('Logged 66.9 kg.')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('1 weigh-in', { exact: true })).toBeVisible();

  // A fortnight of weigh-ins produces a rate verdict.
  await page.evaluate(async () => {
    for (let i = 1; i <= 14; i++) {
      const d = new Date(Date.UTC(2026, 9, 1 + i));
      const date = d.toISOString().slice(0, 10);
      await window.ledger.invoke('weighIns.upsert', { date, weightKg: 65.5 + i * 0.07 });
    }
  });
  await expect(page.getByText(/^(On pace|Too fast|Too slow)$/)).toBeVisible();

  // Training: first set is a personal record.
  await page.getByRole('link', { name: 'Training' }).click();
  await expect(page.getByTestId('training-status')).toHaveText('Training day');
  const squat = page.getByRole('form', { name: 'Log set 1 of Back squat' });
  await squat.getByLabel('Load in kg').fill('60');
  await squat.getByLabel('Reps').fill('8');
  await squat.getByRole('button', { name: 'Log set' }).click();
  await expect(page.getByText(/New best for Back squat: 60 kg × 8/)).toBeVisible();
  const second = page.getByRole('form', { name: 'Log set 2 of Back squat' });
  await expect(second.getByLabel('Load in kg')).toHaveValue('60');
  await expect(page.getByTestId('training-status')).toHaveText('Done for today');

  // Nutrition: one-tap favourite and a custom entry.
  await page.getByRole('link', { name: 'Nutrition' }).click();
  await page.getByRole('button', { name: /^Add Whey shake/ }).click();
  await expect(page.getByText('Added Whey shake.')).toBeVisible();
  await page.getByLabel('Food name').fill('Cafe sandwich');
  await page.getByLabel('Calories', { exact: true }).fill('450');
  await page.getByLabel('Protein in grams').fill('22');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const eaten = page.getByRole('region', { name: 'Eaten today' });
  await expect(eaten.getByText('Cafe sandwich')).toBeVisible();
  await expect(eaten.getByText('Whey shake')).toBeVisible();
  await expect(page.getByText('570', { exact: true })).toBeVisible();

  // Meal prep: plan today's breakfast, see the shopping list, log the plan.
  await page.getByRole('link', { name: 'Meal prep' }).click();
  await page
    .getByLabel('Add to breakfast on 15 Oct 2026')
    .selectOption({ label: 'Oats with milk' });
  await expect(page.getByRole('region', { name: 'Shopping list' }).getByText('oats')).toBeVisible();
  await expect(page.getByText('60 g', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Log today’s plan as eaten' }).click();
  await expect(page.getByText('Logged 1 planned item as eaten today.')).toBeVisible();

  // Photos: stub the native file dialog with two generated images.
  const first = testImage(join(userData, 'a.png'), '#8f560a');
  const secondImage = testImage(join(userData, 'b.png'), '#1d6a5a');
  await page.getByRole('link', { name: 'Photos' }).click();
  const thumbs = page.getByRole('button', { name: /pose on/ });
  for (const [index, [file, date]] of (
    [
      [first, '2026-09-15'],
      [secondImage, '2026-10-15'],
    ] as const
  ).entries()) {
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [path] });
    }, file);
    await page.getByLabel('Date').fill(date);
    await page.getByRole('button', { name: 'Add photos…' }).click();
    await expect(thumbs).toHaveCount(index + 1);
  }
  await thumbs.nth(0).click();
  await expect(page.getByRole('button', { pressed: true, name: /pose on/ })).toHaveCount(1);
  await thumbs.nth(1).click();
  await expect(page.getByRole('button', { pressed: true, name: /pose on/ })).toHaveCount(2);
  await expect(page.getByRole('heading', { name: /days apart/ })).toHaveText(/30 days apart/);
  const loaded = await page
    .locator('figure img')
    .first()
    .evaluate((img: HTMLImageElement) => img.naturalWidth);
  expect(loaded).toBe(300);

  // Today's card summarises it all.
  await page.getByRole('link', { name: 'Today' }).click();
  const card = page.getByRole('article', { name: 'Physique' });
  await expect(card.getByText('Trained today')).toBeVisible();
  await expect(card.getByText(/kcal ·/)).toBeVisible();

  expect(await networkLog(page)).toEqual([]);
  await app.close();
});
