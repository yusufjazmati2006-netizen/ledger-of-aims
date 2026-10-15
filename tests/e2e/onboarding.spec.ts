import { expect, test } from '@playwright/test';
import { completeOnboarding, launchApp, networkLog } from './harness';

test('fresh launch: onboarding, seeded goals, and data that survives a restart', async () => {
  const first = await launchApp();
  const { page } = first;

  // Onboarding is the first thing a new user sees.
  await expect(
    page.getByRole('heading', { name: 'A quiet ledger for four long aims.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Begin' }).click();

  // Validation: an implausible weight is rejected.
  await page.getByLabel('Weight', { exact: true }).fill('7');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toContainText('between 25 and 350 kg');

  await page.getByLabel('Weight', { exact: true }).fill('66,4');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Mushaf: juz 16–30 memorised, continuing backward.
  await expect(page.getByRole('heading', { name: 'Your memorisation so far' })).toBeVisible();
  await page.getByRole('button', { name: 'Juz 16–30' }).click();
  await expect(page.getByText('15 juz · 303 pages')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Shifts: set today (Thursday 15 Oct) to a morning shift.
  await expect(page.getByRole('heading', { name: 'This week’s shifts' })).toBeVisible();
  await page.getByRole('radiogroup', { name: 'Shift on 15 Oct 2026' }).getByText('Morning').click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // The seeded goals and their next milestones are summarised.
  await expect(page.getByText('20 juz memorised · 4 Mar 2027')).toBeVisible();
  await expect(page.getByText('Checkpoint: 71.3 kg · 15 Oct 2027')).toBeVisible();
  await page.getByRole('button', { name: 'Open today' }).click();

  // Today shows the date, the shift and four goal cards.
  await expect(page.getByRole('heading', { name: '15 October' })).toBeVisible();
  await expect(page.getByText('Thursday · morning shift 07:30–16:30')).toBeVisible();
  for (const title of [
    'Quran memorisation',
    'Physique',
    'Business management degree',
    'First game on Steam',
  ]) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
  await expect(page.getByText('66.4 kg', { exact: true })).toBeVisible();

  // Edit the game's next single action.
  await page
    .getByRole('button', { name: 'Edit next single action for First game on Steam' })
    .click();
  await page
    .getByLabel('Next single action for First game on Steam')
    .fill('Install Godot and open the editor');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Install Godot and open the editor')).toBeVisible();

  // Milestones from the brief are all present.
  await page.getByRole('link', { name: 'Milestones' }).click();
  await expect(page.getByText('30 juz memorised')).toBeVisible();
  await expect(page.getByText('Hard stop', { exact: true }).first()).toBeVisible();

  expect(await networkLog(page)).toEqual([]);
  await first.app.close();

  // Reopen with the same data folder: no onboarding, nothing lost.
  const second = await launchApp({ userData: first.userData });
  await expect(second.page.getByRole('heading', { name: '15 October' })).toBeVisible();
  await expect(second.page.getByText('66.4 kg', { exact: true })).toBeVisible();
  await expect(second.page.getByText('Install Godot and open the editor')).toBeVisible();
  await expect(second.page.getByText('Thursday · morning shift 07:30–16:30')).toBeVisible();
  await second.app.close();
});

test('settings: theme, units and shift hours persist', async () => {
  const { app, page, userData } = await launchApp();
  await completeOnboarding(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('radiogroup', { name: 'Weight unit' }).getByText('lb').click();
  await page.getByRole('radiogroup', { name: 'Theme' }).getByText('Dark').click();
  await page.getByLabel('Ends').nth(1).fill('01:30');
  await page.getByLabel('Ends').nth(1).blur();
  await expect(page.getByTestId('network-blocked-count')).toHaveText(
    'Nothing has been blocked this session.',
  );
  await app.close();

  const again = await launchApp({ userData });
  await again.page.getByRole('heading', { name: '15 October' }).waitFor();
  await expect(again.page.getByText('146.4 lb', { exact: true })).toBeVisible();
  const theme = await again.app.evaluate(({ nativeTheme }) => nativeTheme.themeSource);
  expect(theme).toBe('dark');
  await again.page.getByRole('link', { name: 'Settings' }).click();
  await expect(again.page.getByLabel('Ends').nth(1)).toHaveValue('01:30');
  await again.app.close();
});
