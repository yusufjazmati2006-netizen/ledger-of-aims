import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export interface Launched {
  app: ElectronApplication;
  page: Page;
  userData: string;
  backups: string;
}

/** A fresh, isolated data folder per test so real data is never touched. */
export function tempUserData(): string {
  return mkdtempSync(join(tmpdir(), 'ledger-e2e-'));
}

/**
 * Launches the built app (run `electron-vite build` first). The clock is pinned to
 * the brief's start date unless a test says otherwise.
 */
export async function launchApp(
  options: { userData?: string; now?: string; env?: Record<string, string> } = {},
): Promise<Launched> {
  const userData = options.userData ?? tempUserData();
  const backups = join(userData, 'backups');
  const args = [resolve(__dirname, '../../out/main/index.js')];
  // Chromium refuses to run as root without this (only relevant in CI containers).
  if (process.platform === 'linux' && process.getuid?.() === 0) args.unshift('--no-sandbox');
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && k !== 'ELECTRON_RENDERER_URL') env[k] = v;
  }
  const app = await electron.launch({
    args,
    env: {
      ...env,
      LEDGER_USER_DATA: userData,
      LEDGER_BACKUP_DIR: backups,
      LEDGER_NOW: options.now ?? '2026-10-15T09:00:00',
      ...options.env,
    },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page, userData, backups };
}

/**
 * Completes onboarding with the given starting weight (kg). By default juz 16–30
 * are marked memorised (continuing backward); pass `juz: null` to set up later.
 */
export async function completeOnboarding(
  page: Page,
  weightKg = '66.4',
  options: { juz?: 'juz16to30' | null } = {},
): Promise<void> {
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByLabel('Weight', { exact: true }).fill(weightKg);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('heading', { name: 'Your memorisation so far' }).waitFor();
  if (options.juz === null) {
    await page.getByRole('button', { name: 'Set up later' }).click();
  } else {
    await page.getByRole('button', { name: 'Juz 16–30' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
  }
  await page.getByRole('heading', { name: 'This week’s shifts' }).waitFor();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Open today' }).click();
  await page.getByRole('navigation', { name: 'Sections' }).waitFor();
}

export async function networkLog(page: Page): Promise<unknown[]> {
  return page.evaluate(async () => {
    const result = await window.ledger.invoke('diagnostics.networkLog', undefined);
    if (!result.ok) throw new Error(result.error.message);
    return result.data.blocked;
  });
}
