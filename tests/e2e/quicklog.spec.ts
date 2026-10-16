import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { completeOnboarding, launchApp, networkLog } from './harness';

const SHOTS = process.env.LEDGER_SCREENSHOTS;
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

async function invoke<T>(page: Page, channel: string, input?: unknown): Promise<T> {
  return page.evaluate(
    async ([c, i]) => {
      const r = await window.ledger.invoke(c as never, i as never);
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    },
    [channel, input] as const,
  );
}

async function quickWindow(app: ElectronApplication): Promise<Page> {
  for (let i = 0; i < 50; i++) {
    const found = app.windows().find((w) => w.url().includes('#/quick'));
    if (found) return found;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('The quick-log window did not open.');
}

const quickVisible = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().some((w) => w.getTitle() === 'Quick log' && w.isVisible()),
  );

test('⌘K palette: log with the grammar and jump between screens', async () => {
  const { app, page } = await launchApp();
  await completeOnboarding(page);
  const palette = page.getByRole('dialog', { name: 'Command palette' });

  await page.keyboard.press(`${MOD}+K`);
  await expect(palette).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/palette-empty.png` });
  const command = palette.getByRole('combobox', { name: 'Command' });
  await command.fill('w 70.2');
  await expect(palette.getByRole('option', { selected: true })).toContainText(
    'Log 70.2 kg as today’s weight',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/palette-weight.png` });
  await command.press('Enter');
  await expect(palette).toHaveCount(0);
  await expect(page.getByText('Logged 70.2 kg.')).toBeVisible();
  const weights = await invoke<{ weightKg: number }[]>(page, 'weighIns.list', {
    from: '2026-10-15',
    to: '2026-10-15',
  });
  expect(weights.map((w) => w.weightKg)).toEqual([70.2]);

  // Incomplete commands explain themselves; blocked ones say why.
  await page.keyboard.press(`${MOD}+K`);
  await command.fill('r 1-20');
  await expect(palette.getByRole('option').first()).toContainText('solid, shaky or forgotten');
  await command.fill('r 1-20 solid');
  await expect(palette.getByRole('option').first()).toContainText(
    'None of those pages are learned yet',
  );

  // Learn the next two pages, then rate juz 30 (memorised at onboarding).
  await command.fill('p 2');
  await command.press('Enter');
  await expect(page.getByText(/^Learned pp?\. /)).toBeVisible();
  await page.keyboard.press(`${MOD}+K`);
  await command.fill('r j30 solid');
  await command.press('Enter');
  await expect(page.getByText(/^Rated \d+ pages solid\.$/)).toBeVisible();

  // Navigation by words, and Escape to close.
  await page.keyboard.press(`${MOD}+K`);
  await command.fill('plan');
  await command.press('Enter');
  await expect(page.getByRole('heading', { name: /^Week of/ })).toBeVisible();
  await page.keyboard.press(`${MOD}+K`);
  await command.fill('xyz');
  await command.press('Escape');
  await command.press('Escape');
  await expect(palette).toHaveCount(0);

  // Timer from the palette, shown in the sidebar.
  await page.keyboard.press(`${MOD}+K`);
  await command.fill('g start paddles');
  await command.press('Enter');
  await expect(page.getByRole('status', { name: 'Game timer running' })).toBeVisible();
  await page.keyboard.press(`${MOD}+K`);
  await command.fill('g stop');
  await command.press('Enter');
  await expect(page.getByRole('status', { name: 'Game timer running' })).toHaveCount(0);

  expect(await networkLog(page)).toEqual([]);
  await app.close();
});

test('Quick-log window: log from anywhere, then it gets out of the way', async () => {
  const { app, page } = await launchApp();
  await completeOnboarding(page);
  await invoke(page, 'habits.save', { name: 'Phone outside the bedroom' });

  await invoke(page, 'quick.open');
  const quick = await quickWindow(app);
  const input = quick.getByRole('combobox', { name: 'Command' });
  await expect(input).toBeFocused();
  await input.fill('s 1.5h essay plan');
  await expect(quick.getByRole('option', { selected: true })).toContainText(
    'Log 1 h 30 min of study — essay plan',
  );
  if (SHOTS) await quick.screenshot({ path: `${SHOTS}/quick-log.png` });
  await input.press('Enter');
  await expect(quick.getByRole('status')).toContainText('Logged 1 h 30 min of study.');
  await expect.poll(() => quickVisible(app)).toBe(false);
  const study = await invoke<{ minutes: number; note: string }[]>(page, 'study.list', {
    from: '2026-10-15',
    to: '2026-10-15',
  });
  expect(study).toEqual([expect.objectContaining({ minutes: 90, note: 'essay plan' })]);

  // Shown again: the input is cleared and ready. Tick a habit by a word in its name.
  await invoke(page, 'quick.open');
  await expect.poll(() => quickVisible(app)).toBe(true);
  await expect(input).toHaveValue('');
  await input.fill('h phone');
  await input.press('Enter');
  await expect(quick.getByRole('status')).toContainText('Ticked “Phone outside the bedroom”.');

  // "wo" opens today's workout in the main window.
  await invoke(page, 'quick.open');
  await expect.poll(() => quickVisible(app)).toBe(true);
  await input.fill('wo');
  await input.press('Enter');
  await expect(page.getByRole('navigation', { name: 'Physique sections' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Physique sections' }).getByRole('link', {
      name: 'Training',
    }),
  ).toHaveAttribute('aria-current', 'page');

  // Escape hides it without logging anything.
  await invoke(page, 'quick.open');
  await expect.poll(() => quickVisible(app)).toBe(true);
  await input.fill('w 99');
  await input.press('Escape');
  await input.press('Escape');
  await expect.poll(() => quickVisible(app)).toBe(false);

  expect(await networkLog(page)).toEqual([]);
  await app.close();
});

test('Notifications respect shifts and quiet hours, once each', async () => {
  // 09:00 on the day after a night shift: still the sleep window until 10:20.
  const { app, page, userData } = await launchApp();
  await completeOnboarding(page);
  await invoke(page, 'shifts.set', { days: [{ date: '2026-10-14', shiftTypeId: 'night' }] });
  expect(await invoke<unknown[]>(page, 'notifications.runNow')).toEqual([]);
  await app.close();

  // Up at 10:30: the revision reminder (due pages, none revised) goes out once.
  const later = await launchApp({ userData, now: '2026-10-15T10:30:00' });
  const sent = await invoke<{ key: string; path: string }[]>(later.page, 'notifications.runNow');
  expect(sent).toEqual([
    expect.objectContaining({ key: 'revision:2026-10-15', path: '/quran/revision' }),
  ]);
  expect(await invoke<unknown[]>(later.page, 'notifications.runNow')).toEqual([]);

  // Settings: quiet hours and the shortcut recorder.
  await later.page.getByRole('link', { name: 'Settings', exact: true }).click();
  const notifications = later.page.getByRole('region', { name: 'Notifications' });
  await expect(notifications.getByRole('switch', { name: 'Quran revision' })).toBeChecked();
  const shortcut = later.page.getByRole('button', { name: /Quick-log shortcut/ });
  await expect(shortcut).toHaveText('Control+Shift+Space');
  await shortcut.click();
  await later.page.keyboard.press('Control+Alt+L');
  await expect(later.page.getByRole('button', { name: /Quick-log shortcut/ })).toHaveText(
    'Control+Alt+L',
  );
  const status = await invoke<{ shortcut: string }>(later.page, 'system.status');
  expect(status.shortcut).toBe('Control+Alt+L');
  if (SHOTS)
    await later.page.screenshot({ path: `${SHOTS}/settings-notifications.png`, fullPage: true });
  expect(await networkLog(later.page)).toEqual([]);
  await later.app.close();

  // 23:00 is in quiet hours: nothing, even with the weigh-in still missing tomorrow.
  const night = await launchApp({ userData, now: '2026-10-16T23:00:00' });
  expect(await invoke<unknown[]>(night.page, 'notifications.runNow')).toEqual([]);
  await night.app.close();
});
