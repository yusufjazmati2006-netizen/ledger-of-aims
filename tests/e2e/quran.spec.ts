import { expect, test } from '@playwright/test';
import { completeOnboarding, launchApp, networkLog } from './harness';

test('Quran: verdict, revision with undo, logging pages, mushaf, and an automatic milestone', async () => {
  const { app, page } = await launchApp();
  await completeOnboarding(page);

  // Today's Quran card reflects the set-up.
  const quranCard = page.getByRole('article', { name: 'Quran memorisation' });
  await expect(quranCard.getByText('303')).toBeVisible();
  await expect(quranCard.getByText('Exactly on track')).toBeVisible();

  // Overview.
  await page.getByRole('link', { name: 'Quran' }).click();
  await expect(page.getByTestId('quran-verdict')).toHaveText('Exactly on track');
  await expect(page.getByText('101 pages to 20 juz by 4 Mar 2027')).toBeVisible();

  // Revision: rate a page, then undo it.
  await page.getByRole('link', { name: 'Revision' }).click();
  const summary = page.getByTestId('queue-summary');
  await expect(summary).toContainText('11 pages due');
  await page
    .getByRole('group', { name: 'Rate page 302' })
    .getByRole('button', { name: /^Solid/ })
    .click();
  await expect(summary).toContainText('10 pages due');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(summary).toContainText('11 pages due');

  // Keyboard rating: focus a page row and press 2 (shaky).
  await page.getByRole('listitem', { name: /^Page 303,/ }).focus();
  await page.keyboard.press('2');
  await expect(summary).toContainText('10 pages due');
  await expect(page.getByTestId('revision-streak')).toHaveText('1 day');

  // Log three new pages from the header dialog.
  await page.getByRole('button', { name: 'Log new pages' }).click();
  await page.getByRole('button', { name: 'More pages' }).click();
  await page.getByRole('button', { name: 'More pages' }).click();
  await expect(page.getByRole('dialog').getByText('pp. 282–284')).toBeVisible();
  await page.getByRole('button', { name: 'Log 3 pages' }).click();
  await expect(page.getByText('Logged pp. 282–284 as learned today.')).toBeVisible();

  await page.getByRole('link', { name: 'Overview' }).click();
  await expect(page.getByTestId('quran-verdict')).toHaveText('Ahead by 3 pages');

  // Mushaf: inspect a page and mark juz 11–15 memorised to reach 20 juz.
  await page.getByRole('link', { name: 'Mushaf' }).click();
  await page.getByRole('gridcell', { name: /^Page 282,/ }).click();
  await expect(page.getByRole('complementary').getByText('Recently learned').first()).toBeVisible();
  await page.getByRole('gridcell', { name: /^Page 201,/ }).click();
  await page.getByRole('gridcell', { name: /^Page 301,/ }).click({ modifiers: ['Shift'] });
  await expect(page.getByRole('heading', { name: '101 pages' })).toBeVisible();
  await page.getByRole('button', { name: 'Memorised', exact: true }).click();

  // The "20 juz" milestone completes itself and is celebrated.
  const celebration = page.getByRole('dialog', { name: '20 juz memorised' });
  await expect(celebration).toBeVisible();
  await celebration.getByRole('button', { name: 'Continue' }).click();
  await expect(celebration).toBeHidden();

  await page.getByRole('link', { name: 'Milestones' }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Mark not done: 20 juz memorised' }),
  ).toBeVisible();

  expect(await networkLog(page)).toEqual([]);
  await app.close();
});

test('Quran: the mushaf can be set up later from the Quran screen', async () => {
  const { app, page } = await launchApp();
  await completeOnboarding(page, '66.4', { juz: null });
  await page.getByRole('link', { name: 'Quran' }).click();
  await expect(page.getByRole('heading', { name: 'Set up your mushaf' })).toBeVisible();
  await page.getByRole('button', { name: 'Juz 30', exact: true }).click();
  await page.getByRole('button', { name: 'Set up mushaf' }).click();
  await expect(page.getByTestId('quran-verdict')).toBeVisible();
  await expect(page.getByText('23 pages', { exact: false }).first()).toBeVisible();
  await app.close();
});
