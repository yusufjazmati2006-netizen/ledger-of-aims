import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { completeOnboarding, launchApp, tempUserData } from './harness';

test('a corrupted database offers recovery and can start fresh without deleting anything', async () => {
  const userData = tempUserData();
  writeFileSync(join(userData, 'ledger.sqlite'), 'not a database '.repeat(500));

  const { app, page } = await launchApp({ userData });
  await expect(page.getByRole('heading', { name: 'Your ledger needs attention' })).toBeVisible();
  await expect(page.getByText('The database file appears to be damaged.')).toBeVisible();
  await expect(page.getByText('No valid backups were found')).toBeVisible();

  await page.getByRole('button', { name: 'Start with a fresh ledger' }).click();
  await page.getByRole('button', { name: 'Start fresh' }).click();
  await expect(
    page.getByRole('heading', { name: 'A quiet ledger for four long aims.' }),
  ).toBeVisible();
  expect(readdirSync(join(userData, 'quarantine'))).toHaveLength(1);
  await app.close();
});

test('a corrupted database can be restored from the newest backup', async () => {
  // 1. Create a ledger with data, then keep a copy as a "backup".
  const first = await launchApp();
  await completeOnboarding(first.page, '70.2');
  await first.app.close();
  mkdirSync(first.backups, { recursive: true });
  copyFileSync(
    join(first.userData, 'ledger.sqlite'),
    join(first.backups, 'ledger-daily-2026-10-15.sqlite'),
  );

  // 2. Damage the live database.
  writeFileSync(join(first.userData, 'ledger.sqlite'), Buffer.alloc(8192, 7));

  // 3. Relaunch: recovery lists the backup; restore it.
  const second = await launchApp({ userData: first.userData });
  await expect(
    second.page.getByRole('heading', { name: 'Your ledger needs attention' }),
  ).toBeVisible();
  await expect(second.page.getByText('ledger-daily-2026-10-15.sqlite')).toBeVisible();
  // The app's own daily backup (made at first launch, before onboarding) is listed too.
  await second.page
    .getByRole('listitem')
    .filter({ hasText: 'ledger-daily-2026-10-15.sqlite' })
    .getByRole('button', { name: 'Restore' })
    .click();
  await expect(second.page.getByRole('heading', { name: '15 October' })).toBeVisible();
  await expect(second.page.getByText('70.2 kg', { exact: true })).toBeVisible();
  await second.app.close();
});
