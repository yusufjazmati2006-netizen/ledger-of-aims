import { readFileSync } from 'node:fs';
import { type Page } from '@playwright/test';
import { completeOnboarding, expect, launchApp, test } from './harness';

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

/** Every screen, including sub-screens, as the hash routes the app uses. */
const ROUTES = [
  '/',
  '/quran',
  '/quran/revision',
  '/quran/mushaf',
  '/quran/log',
  '/game',
  '/game/learning',
  '/game/practice',
  '/game/time',
  '/game/devlog',
  '/game/steam',
  '/degree',
  '/degree/modules',
  '/degree/calendar',
  '/degree/study',
  '/physique',
  '/physique/training',
  '/physique/nutrition',
  '/physique/meal-prep',
  '/physique/photos',
  '/planner',
  '/review',
  '/review/history',
  '/review/habits',
  '/milestones',
  '/search?q=juz',
  '/settings',
];

/** axe-core, injected through DevTools (Electron cannot open the helper page that
 * @axe-core/playwright uses, and the app's CSP rightly forbids inline scripts). */
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodes: { target: string[]; failureSummary?: string }[];
}

async function audit(page: Page, label: string): Promise<string[]> {
  // Let entrance animations finish so colours are measured at rest (a fixed pause
  // is not enough on a slow CI machine). Endless ones, such as spinners, are skipped.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  const loaded = await page.evaluate(() => 'axe' in window);
  if (!loaded) await page.evaluate(AXE);
  const violations = await page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: { run: (ctx: Document, opts: unknown) => Promise<{ violations: unknown[] }> };
      }
    ).axe;
    const result = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    });
    return result.violations;
  });
  return (violations as AxeViolation[]).map(
    (v) =>
      `${label}: ${v.id} (${v.impact ?? 'n/a'}) — ${v.help}\n    ${v.nodes
        .slice(0, 3)
        .map(
          (n) =>
            `${n.target.join(' ')} :: ${(n.failureSummary ?? '').split('\n').slice(1, 2).join('')}`,
        )
        .join('\n    ')}`,
  );
}

test('every screen passes axe (WCAG 2.2 A/AA) in light and dark', async () => {
  test.setTimeout(240_000);
  const { app, page } = await launchApp();
  await completeOnboarding(page);
  // A little content so lists, charts and cards are not all empty states.
  await page.evaluate(async () => {
    const call = (c: string, i?: unknown) => window.ledger.invoke(c as never, i as never);
    await call('devlog.save', {
      date: '2026-10-15',
      title: 'Week one',
      body: '**Paddles** feel right.',
      tags: ['pong'],
    });
    await call('habits.save', { name: 'Phone outside the bedroom' });
    await call('time.addManual', { date: '2026-10-15', minutes: 45, note: 'Tilemap' });
    await call('study.log', { date: '2026-10-14', minutes: 60 });
  });

  // On macOS the sidebar is transparent so the window's vibrancy shows through; axe
  // cannot see that material and would measure against white. Audit with the opaque
  // sidebar colour the material stands for (as on other platforms).
  await page.evaluate(() => {
    document.documentElement.dataset.platform = 'audit';
  });

  const violations: string[] = [];
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate(async (t) => {
      await window.ledger.invoke('settings.update', { namespace: 'general', patch: { theme: t } });
    }, theme);
    await page.waitForFunction((t) => document.documentElement.dataset.theme === t, theme);
    for (const route of ROUTES) {
      await page.evaluate((r) => {
        window.location.hash = `#${r}`;
      }, route);
      await page.getByRole('main').waitFor();
      violations.push(...(await audit(page, `${theme} ${route}`)));
    }
    // The command palette, open over Today.
    await page.evaluate(() => {
      window.location.hash = '#/';
    });
    await page.keyboard.press(`${MOD}+K`);
    await page.getByRole('dialog', { name: 'Command palette' }).waitFor();
    violations.push(...(await audit(page, `${theme} palette`)));
    await page.keyboard.press('Escape');
  }
  if (violations.length > 0) console.error(violations.join('\n'));
  expect(violations).toEqual([]);
  await app.close();
});
