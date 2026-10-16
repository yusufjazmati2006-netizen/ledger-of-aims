import { _electron as electron, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export interface Launched {
  app: ElectronApplication;
  page: Page;
  userData: string;
  backups: string;
}

/** Apps still open when a test ends (it failed or timed out before closing them). */
const open = new Set<ElectronApplication>();

/** Stops an app that will not quit (on macOS a stuck app holds the worker open). */
async function forceClose(app: ElectronApplication): Promise<void> {
  open.delete(app);
  const quit = app.close().catch(() => undefined);
  const timedOut = await Promise.race([
    quit.then(() => false),
    new Promise<boolean>((r) => setTimeout(() => r(true), 10_000)),
  ]);
  if (timedOut) app.process().kill('SIGKILL');
}

test.afterEach(async () => {
  await Promise.all([...open].map(forceClose));
});

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
  // LEDGER_E2E_EXECUTABLE runs the suite against a packaged app instead of `out/`.
  const packaged = process.env.LEDGER_E2E_EXECUTABLE;
  const args = packaged ? [] : [resolve(__dirname, '../../out/main/index.js')];
  // Chromium refuses to run as root without this (only relevant in CI containers).
  if (process.platform === 'linux' && process.getuid?.() === 0) args.unshift('--no-sandbox');
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && k !== 'ELECTRON_RENDERER_URL') env[k] = v;
  }
  const app = await electron.launch({
    ...(packaged ? { executablePath: packaged } : {}),
    args,
    env: {
      ...env,
      LEDGER_USER_DATA: userData,
      LEDGER_BACKUP_DIR: backups,
      LEDGER_NOW: options.now ?? '2026-10-15T09:00:00',
      // Reminders are checked on demand, and the quick-log window stays open when an
      // unfocused virtual display would otherwise hide it.
      LEDGER_NOTIFY_MANUAL: '1',
      LEDGER_KEEP_QUICK_OPEN: '1',
      ...options.env,
    },
  });
  open.add(app);
  // The main window, not the quick-log window the app also creates.
  let page = app.windows().find((w) => !w.url().includes('#/quick'));
  while (!page) {
    const next = await app.waitForEvent('window');
    if (!next.url().includes('#/quick')) page = next;
  }
  await page.waitForLoadState('domcontentloaded');
  // Every test, on closing the app, also proves the app made no network request.
  const close = app.close.bind(app);
  app.close = async () => {
    if (!page.isClosed()) {
      const blocked = await networkLog(page);
      if (blocked.length > 0)
        throw new Error(`The app attempted network requests: ${JSON.stringify(blocked)}`);
    }
    await close();
    open.delete(app);
  };
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
