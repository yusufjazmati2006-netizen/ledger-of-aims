import {
  _electron as electron,
  test as base,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
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

/** Kills the app and its helper processes (Playwright starts it as a process group). */
function kill(app: ElectronApplication): void {
  const child = app.process();
  try {
    if (child.pid) process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
}

/** Waits for a quit, but never forever: a stuck app would hold the test worker open. */
async function quitWithin(quit: () => Promise<void>, app: ElectronApplication): Promise<boolean> {
  const quitted = await Promise.race([
    quit().then(
      () => true,
      () => false,
    ),
    new Promise<boolean>((r) => setTimeout(() => r(false), 20_000)),
  ]);
  if (!quitted) kill(app);
  open.delete(app);
  return quitted;
}

/**
 * Use this `test` in every spec: it shuts down any app a test left open (because it
 * failed or timed out), so one slow test cannot stall the rest of the run.
 */
export const test = base.extend<{ closeLeftoverApps: undefined }>({
  closeLeftoverApps: [
    // Playwright reads fixture dependencies from this (empty) destructuring.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await use(undefined);
      await Promise.all([...open].map((app) => quitWithin(() => app.close(), app)));
    },
    { auto: true },
  ],
});
export { expect } from '@playwright/test';

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
    if (!(await quitWithin(close, app))) {
      console.warn('[harness] the app did not quit within 20 s and was stopped');
    }
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
