import { completeOnboarding, expect, launchApp, networkLog, test } from './harness';

const SHOTS = process.env.LEDGER_SCREENSHOTS;

test('Game: roadmap, learning, practice, time, devlog, Steam checklist and Today', async () => {
  const { app, page, userData } = await launchApp();
  await completeOnboarding(page);
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'Game' })
    .click();
  const tabs = page.getByRole('navigation', { name: 'Game sections' });

  // The next single action, edited in place.
  await page.getByRole('button', { name: 'Edit the next single action for the game' }).click();
  await page.getByLabel('Next single action for the game').fill('Install the engine tonight');
  await page.getByLabel('Next single action for the game').press('Enter');
  await expect(page.getByText('Install the engine tonight')).toBeVisible();

  // Roadmap: finishing a task unblocks the next; a dependency loop is refused.
  const choose = 'Choose an engine and record why';
  const tutorial = 'Finish the engine’s official beginner tutorial';
  await expect(
    page.getByRole('checkbox', { name: `Mark done: ${tutorial}` }).first(),
  ).toHaveAttribute('aria-disabled', 'true');
  await page
    .getByRole('checkbox', { name: `Mark done: ${choose}` })
    .first()
    .click();
  await expect(page.getByRole('checkbox', { name: `Mark not done: ${choose}` })).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: `Mark done: ${tutorial}` }).first(),
  ).not.toHaveAttribute('aria-disabled', 'true');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/game-roadmap.png`, fullPage: true });

  await page.getByRole('button', { name: `Edit task ${choose}` }).click();
  const taskDialog = page.getByRole('dialog', { name: 'Edit task' });
  await taskDialog.getByLabel('Add a task this one waits on').selectOption({ label: tutorial });
  await taskDialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(taskDialog.getByRole('alert')).toContainText('loop');
  await taskDialog.getByRole('button', { name: 'Cancel' }).click();

  // Learning path: a resource link opens externally (never inside the app).
  await tabs.getByRole('link', { name: 'Learning path' }).click();
  const compare = page.getByRole('region', { name: 'Compare two or three engines' });
  await compare.getByLabel('Link label').fill('Engine docs');
  await compare.getByLabel('Link URL').fill('https://example.com/docs');
  await compare.getByRole('button', { name: 'Add link' }).click();
  const link = compare.getByRole('link', { name: 'Engine docs' });
  await expect(link).toHaveAttribute('href', 'https://example.com/docs');
  await expect(link).toHaveAttribute('target', '_blank');
  await compare.getByRole('checkbox', { name: 'Compare two or three engines done' }).click();
  await expect(
    compare.getByRole('checkbox', { name: 'Compare two or three engines done' }),
  ).toHaveAttribute('aria-checked', 'true');

  // Practice board: move Pong into progress.
  await tabs.getByRole('link', { name: 'Practice projects' }).click();
  await page.getByLabel('Move Pong').selectOption({ label: 'In progress' });
  await expect(
    page.getByRole('region', { name: /In progress/ }).getByText('Pong', { exact: true }),
  ).toBeVisible();

  // Time: a timer (with the sidebar indicator), a manual entry, and a correction.
  await tabs.getByRole('link', { name: 'Time' }).click();
  await page.getByLabel('What are you working on?').fill('Pong paddle movement');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(page.getByRole('status', { name: 'Game timer running' })).toBeVisible();
  const timer = page.getByRole('group', { name: 'Running timer' });
  await timer.getByLabel('Focus session', { exact: true }).check();
  await timer.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByRole('status', { name: 'Game timer running' })).toHaveCount(0);
  const log = page.getByRole('region', { name: 'Session log' });
  await expect(log.getByText('Pong paddle movement')).toBeVisible();
  await expect(log.getByText('Focus', { exact: true })).toBeVisible();

  const manual = page.getByRole('form', { name: 'Add time manually' });
  await manual.getByLabel('Duration').fill('banana');
  await manual.getByRole('button', { name: 'Add entry' }).click();
  await expect(manual.getByRole('alert')).toContainText('duration');
  await manual.getByLabel('Duration').fill('1.5h');
  await manual.getByLabel('What did you work on?').fill('Art pass');
  await manual.getByRole('button', { name: 'Add entry' }).click();
  await expect(log.getByText('Art pass')).toBeVisible();
  await expect(log.getByRole('listitem').filter({ hasText: 'Art pass' })).toContainText(
    '1 h 30 min',
  );

  await log.getByRole('button', { name: 'Edit entry Art pass' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit time entry' });
  await editDialog.getByLabel('Duration').fill('2h');
  await editDialog.getByRole('button', { name: 'Save' }).click();
  await expect(log.getByRole('listitem').filter({ hasText: 'Art pass' })).toContainText('2 h');
  // By keyboard: a toast may sit over the control for a few seconds.
  await log.getByRole('radio', { name: 'Focus only' }).focus();
  await page.keyboard.press('Space');
  await expect(log.getByText('Art pass')).toHaveCount(0);
  await expect(log.getByText('Pong paddle movement')).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/game-time.png`, fullPage: true });

  // Devlog: markdown with a preview, tags and a filter.
  await tabs.getByRole('link', { name: 'Devlog' }).click();
  await page.getByRole('button', { name: 'Write the first entry' }).click();
  const editor = page.getByRole('dialog', { name: 'New devlog entry' });
  await editor.getByLabel('Title').fill('Week one: Pong');
  await editor.getByLabel('Tags').fill('Pong, #input');
  await editor
    .getByRole('textbox', { name: 'Entry' })
    .fill(
      'Paddles **finally** feel right.\n\n- [x] paddle\n- [ ] score\n\n[Docs](https://example.com)',
    );
  await editor.getByRole('radio', { name: 'Preview' }).focus();
  await page.keyboard.press('Space');
  await expect(editor.locator('strong', { hasText: 'finally' })).toBeVisible();
  await editor.getByRole('button', { name: 'Save' }).click();
  const entry = page.getByRole('article', { name: 'Week one: Pong' });
  await expect(entry.locator('strong', { hasText: 'finally' })).toBeVisible();
  await expect(entry.getByRole('link', { name: 'Docs' })).toHaveAttribute('target', '_blank');
  await expect(entry.getByRole('button', { name: 'Show entries tagged pong' })).toBeVisible();
  await expect(entry.getByRole('button', { name: 'Show entries tagged input' })).toBeVisible();
  await page.getByLabel('Search the devlog').fill('nothing like this');
  await expect(page.getByText('No entries match.')).toBeVisible();
  await page.getByLabel('Search the devlog').fill('paddles');
  await expect(entry).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/game-devlog.png`, fullPage: true });

  // Steam readiness: verification flagged prominently; progress counts.
  await tabs.getByRole('link', { name: 'Steam readiness' }).click();
  await expect(page.getByRole('note', { name: 'Verification required' })).toBeVisible();
  await expect(page.getByText('Verify', { exact: true }).first()).toBeVisible();
  await page.getByRole('checkbox', { name: 'Steamworks partner account' }).check();
  await expect(page.getByText(/^1\s*of 22 done$/)).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/game-steam.png`, fullPage: true });

  // Today: the game card shows progress, hours and what is up next.
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'Today' })
    .click();
  const card = page.getByRole('article', { name: 'First game on Steam' });
  await expect(card.getByText(/of 6 h this week/)).toContainText('2.0');
  await expect(card.getByText(`Up next: ${tutorial}`)).toBeVisible();
  await expect(card.getByText('Install the engine tonight')).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/today-game.png`, fullPage: true });

  // A running timer survives a restart.
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'Game' })
    .click();
  await tabs.getByRole('link', { name: 'Time' }).click();
  await page.getByLabel('What are you working on?').fill('Overnight test');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  expect(await networkLog(page)).toEqual([]);
  await app.close();

  const second = await launchApp({ userData, now: '2026-10-15T11:00:00' });
  await expect(second.page.getByRole('status', { name: 'Game timer running' })).toBeVisible();
  await second.page.getByRole('link', { name: 'Game' }).click();
  await second.page
    .getByRole('navigation', { name: 'Game sections' })
    .getByRole('link', { name: 'Time' })
    .click();
  await expect(second.page.getByRole('timer')).toBeVisible();
  await expect(second.page.getByLabel('What are you working on?')).toHaveValue('Overnight test');
  expect(await networkLog(second.page)).toEqual([]);
  await second.app.close();
});
