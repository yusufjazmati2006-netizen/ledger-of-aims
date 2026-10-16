import { type ElectronApplication, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { completeOnboarding, expect, launchApp, networkLog, test } from './harness';

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

const weights = async (page: Page) =>
  (await invoke<{ weightKg: number }[]>(page, 'weighIns.list', {})).map((w) => w.weightKg).sort();

/** Native dialogs cannot be driven by tests, so they are replaced with fixed answers. */
async function stubDialogs(
  app: ElectronApplication,
  answers: { save?: string; open?: string },
): Promise<void> {
  await app.evaluate(({ dialog }, { save, open }) => {
    if (save !== undefined)
      dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: save });
    if (open !== undefined)
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [open] });
  }, answers);
}

async function openSettings(page: Page) {
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Backups' })).toBeVisible();
}

test('Backups: daily on launch, manual on demand, restore keeps a snapshot', async () => {
  const { app, page } = await launchApp();
  await completeOnboarding(page);
  await expect
    .poll(async () => (await invoke<{ label: string }[]>(page, 'backups.list')).map((b) => b.label))
    .toContain('daily');

  await invoke(page, 'weighIns.upsert', { date: '2026-10-14', weightKg: 65.9 });
  await openSettings(page);
  const backups = page.getByRole('region', { name: 'Backups' });
  await backups.getByRole('button', { name: 'Back up now' }).click();
  await expect(page.getByText('Backed up.')).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-backups.png`, fullPage: true });

  // Something logged after the backup is undone by restoring it…
  await invoke(page, 'weighIns.upsert', { date: '2026-10-13', weightKg: 67 });
  expect(await weights(page)).toEqual([65.9, 66.4, 67]);
  const manual = backups.getByRole('list', { name: 'Backups' }).getByRole('listitem').filter({
    hasText: 'Manual',
  });
  await manual.getByRole('button', { name: /^Restore backup/ }).click();
  await page
    .getByRole('dialog', { name: 'Restore this backup?' })
    .getByRole('button', { name: 'Restore' })
    .click();
  await expect(page.getByRole('heading', { name: '15 October' })).toBeVisible();
  await expect.poll(() => weights(page)).toEqual([65.9, 66.4]);

  // …and the state just before the restore is itself kept.
  const labels = (await invoke<{ label: string }[]>(page, 'backups.list')).map((b) => b.label);
  expect(labels).toEqual(expect.arrayContaining(['daily', 'manual', 'pre-restore']));
  expect(await networkLog(page)).toEqual([]);
  await app.close();
});

test('A custom backup folder is still found when the database is damaged', async () => {
  const first = await launchApp();
  await completeOnboarding(first.page, '70.2');
  const custom = join(first.userData, 'external-drive', 'Ledger');
  mkdirSync(custom, { recursive: true });
  await stubDialogs(first.app, { open: custom });
  await openSettings(first.page);
  await first.page
    .getByRole('region', { name: 'Backups' })
    .getByRole('button', { name: 'Change…' })
    .click();
  await expect(first.page.getByTestId('backup-folder')).toHaveText(custom);
  // Choosing a folder makes today's backup there straight away.
  await expect.poll(() => readdirSync(custom).filter((f) => f.endsWith('.sqlite')).length).toBe(1);
  await first.app.close();

  writeFileSync(join(first.userData, 'ledger.sqlite'), Buffer.alloc(8192, 7));
  const second = await launchApp({ userData: first.userData });
  await expect(
    second.page.getByRole('heading', { name: 'Your ledger needs attention' }),
  ).toBeVisible();
  await expect(second.page.getByText(/^ledger-daily-/)).toBeVisible();
  await second.page.getByRole('button', { name: 'Restore' }).click();
  await expect(second.page.getByRole('heading', { name: '15 October' })).toBeVisible();
  expect(await weights(second.page)).toEqual([70.2]);
  await second.app.close();
});

test('Export everything, import with a preview, and export a calendar', async () => {
  const { app, page, userData } = await launchApp();
  await completeOnboarding(page);
  await openSettings(page);
  const exportPath = join(userData, 'export.json');
  await stubDialogs(app, { save: exportPath });
  const exportSection = page.getByRole('region', { name: 'Export & import' });
  await exportSection.getByRole('button', { name: 'Export all data…' }).click();
  await expect(page.getByText('Exported to export.json.')).toBeVisible();
  const file = JSON.parse(readFileSync(exportPath, 'utf8')) as {
    format: string;
    tables: Record<string, unknown[]>;
  };
  expect(file.format).toBe('ledger-of-aims-export');
  expect(file.tables.weigh_ins).toHaveLength(1);

  // A later weigh-in, then import the export: the preview says what changes.
  await invoke(page, 'weighIns.upsert', { date: '2026-10-10', weightKg: 66.9 });
  await stubDialogs(app, { open: exportPath });
  await exportSection.getByRole('button', { name: 'Import…' }).click();
  const preview = page.getByRole('dialog', { name: 'Replace your data with this export?' });
  const row = preview.getByRole('row', { name: /Weigh-ins/ });
  await expect(row.getByRole('cell').nth(1)).toHaveText('2');
  await expect(row.getByRole('cell').nth(2)).toHaveText('1');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/import-preview.png` });
  await preview.getByRole('button', { name: 'Replace my data' }).click();
  await expect(page.getByRole('heading', { name: '15 October' })).toBeVisible();
  await expect.poll(() => weights(page)).toEqual([66.4]);
  expect((await invoke<{ label: string }[]>(page, 'backups.list')).map((b) => b.label)).toContain(
    'pre-import',
  );

  // A file that is not an export is refused before anything changes.
  const bad = join(userData, 'bad.json');
  writeFileSync(bad, JSON.stringify({ hello: 1 }));
  await openSettings(page);
  await stubDialogs(app, { open: bad });
  await page
    .getByRole('region', { name: 'Export & import' })
    .getByRole('button', { name: 'Import…' })
    .click();
  await expect(page.getByText(/not a Ledger of Aims export/)).toBeVisible();

  // Calendar export.
  const icsPath = join(userData, 'ledger.ics');
  await invoke(page, 'shifts.set', { days: [{ date: '2026-10-16', shiftTypeId: 'night' }] });
  await stubDialogs(app, { save: icsPath });
  await page
    .getByRole('region', { name: 'Export & import' })
    .getByRole('button', { name: 'Export to Calendar…' })
    .click();
  await expect(page.getByText(/^Exported \d+ events\.$/)).toBeVisible();
  const ics = readFileSync(icsPath, 'utf8');
  expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
  expect(ics).toContain('SUMMARY:Quran: 20 juz memorised');
  expect(ics).toContain('SUMMARY:Night shift\r\n');
  expect(ics).toContain('DTEND:20261017T010000');

  expect(await networkLog(page)).toEqual([]);
  await app.close();
});

test('Search finds what you have written, from ⌘K or the Search screen', async () => {
  const { app, page } = await launchApp();
  await completeOnboarding(page);
  await invoke(page, 'devlog.save', {
    date: '2026-10-15',
    title: 'Week one',
    body: 'The paddles finally feel responsive.',
    tags: ['pong'],
  });

  await page.keyboard.press(`${MOD}+K`);
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await palette.getByRole('combobox', { name: 'Command' }).fill('paddl');
  await palette.getByRole('option', { name: /Week one/ }).click();
  await expect(page.getByRole('article', { name: 'Week one' })).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'Search' })
    .click();
  await page.getByLabel('Search everything').fill('juz');
  const milestones = page.getByRole('region', { name: 'Milestone' });
  await expect(milestones.getByText('20 juz memorised')).toBeVisible();
  await expect(milestones.locator('mark').first()).toHaveText('juz');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/search.png`, fullPage: true });
  await milestones.getByRole('link', { name: /20 juz memorised/ }).click();
  await expect(page.getByRole('heading', { name: 'Milestones' })).toBeVisible();
  expect(await networkLog(page)).toEqual([]);
  await app.close();
});
