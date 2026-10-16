import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // GitHub's macOS runners can be much slower than a desktop Mac; allow for it there,
  // and retry once so a slow machine is reported as "flaky" rather than failing.
  timeout: process.env.CI ? 120_000 : 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // On GitHub Actions, failures also appear as annotations on the run.
  reporter: process.env.GITHUB_ACTIONS ? [['list'], ['github']] : [['list']],
  use: {
    // A stuck click or fill fails at that step, not as an unexplained test timeout.
    actionTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
