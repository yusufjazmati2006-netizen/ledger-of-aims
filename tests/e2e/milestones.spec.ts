import { expect, test } from '@playwright/test';
import { completeOnboarding, launchApp } from './harness';

test('milestones: add, edit, reorder by keyboard, complete with celebration, delete', async () => {
  const { app, page, userData } = await launchApp();
  await completeOnboarding(page);
  await page.getByRole('link', { name: 'Milestones' }).click();

  const degree = page.getByRole('region', { name: 'Business management degree' });
  await degree.getByRole('button', { name: 'Add milestone' }).click();
  const dialog = page.getByRole('dialog', { name: 'New milestone' });
  await dialog.getByLabel('Title').fill('Level 4 complete');
  await dialog.getByLabel('Target date').fill('2027-09-30');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(degree.getByText('Level 4 complete')).toBeVisible();

  // Edit it.
  await degree.getByRole('button', { name: 'Edit Level 4 complete' }).click();
  await page
    .getByRole('dialog', { name: 'Edit milestone' })
    .getByLabel('Title')
    .fill('Year one complete');
  await page
    .getByRole('dialog', { name: 'Edit milestone' })
    .getByRole('button', { name: 'Save' })
    .click();
  await expect(degree.getByText('Year one complete')).toBeVisible();

  // Reorder with the keyboard: move "Year one complete" above the existing milestone.
  const items = degree.getByRole('listitem');
  await expect(items.nth(1)).toContainText('Year one complete');
  await degree.getByRole('button', { name: 'Reorder Year one complete' }).focus();
  // dnd-kit measures between key presses, so give each step a frame or two.
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(200);
  await page.keyboard.press('Space');
  await expect(items.nth(0)).toContainText('Year one complete');

  // Complete it: a quiet celebration appears.
  await degree.getByRole('checkbox', { name: 'Mark done: Year one complete' }).click();
  const celebration = page.getByRole('dialog', { name: 'Year one complete' });
  await expect(celebration).toBeVisible();
  await expect(celebration.getByText(/Reached \d+ days before 30 Sept? 2027\./)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(celebration).toBeHidden();

  // Order and completion survive a restart.
  await app.close();
  const again = await launchApp({ userData });
  await again.page.getByRole('link', { name: 'Milestones' }).click();
  const degreeAgain = again.page.getByRole('region', { name: 'Business management degree' });
  await expect(degreeAgain.getByRole('listitem').nth(0)).toContainText('Year one complete');
  await expect(
    degreeAgain.getByRole('checkbox', { name: 'Mark not done: Year one complete' }),
  ).toBeVisible();

  // Delete.
  await degreeAgain.getByRole('button', { name: 'Delete Year one complete' }).click();
  await again.page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(degreeAgain.getByText('Year one complete')).toBeHidden();
  await again.app.close();
});
