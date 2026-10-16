import { completeOnboarding, expect, launchApp, networkLog, test } from './harness';

const SHOTS = process.env.LEDGER_SCREENSHOTS;

test('Planner: shifts, a proposed week, conflicts and drag-to-adjust', async () => {
  // Thursday 15 Oct, 09:00; the week starts Monday 12 Oct.
  const { app, page } = await launchApp();
  await completeOnboarding(page);
  await page.evaluate(async () => {
    await window.ledger.invoke('shifts.set', {
      days: [
        { date: '2026-10-15', shiftTypeId: 'night' },
        { date: '2026-10-17', shiftTypeId: 'off' },
      ],
    });
  });
  const nav = page.getByRole('navigation', { name: 'Sections' });
  await nav.getByRole('link', { name: 'Planner' }).click();
  await expect(page.getByRole('heading', { name: 'Week of 12 Oct' })).toBeVisible();
  await expect(page.getByText('Nothing planned this week')).toBeVisible();

  // A morning shift after tonight's night shift: flagged as short sleep.
  await page.getByLabel('Shift on Fri 16 Oct').selectOption({ label: 'Morning' });
  await expect(page.getByText('Short sleep')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Conflicts' })).toContainText(
    'possible for sleep between shifts',
  );

  // Propose, preview, accept.
  await page.getByRole('button', { name: 'Propose a plan' }).click();
  await expect(page.getByTestId('proposed-block').first()).toBeVisible();
  const today = page.getByRole('group', { name: 'Thu 15 Oct' });
  // Nothing before now (09:00) and nothing into tonight's shift.
  await expect(
    today.getByTestId('proposed-block').filter({ hasText: '09:10' }).first(),
  ).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/planner-preview.png`, fullPage: true });
  await page.getByRole('button', { name: 'Accept plan' }).click();
  await expect(page.getByTestId('proposed-block')).toHaveCount(0);
  const study = today.getByRole('button', { name: /^Study, Thu 10:20 to 11:20, proposed/ });
  await expect(study).toBeVisible();

  // Keyboard drag: Space to pick up, four steps of 15 minutes down, Space to drop.
  await study.focus();
  await page.keyboard.press('Space');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  const moved = today.getByRole('button', { name: /^Study, Thu 11:20 to 12:20, has a conflict/ });
  await expect(moved).toBeVisible();
  await expect(page.getByRole('region', { name: 'Conflicts' })).toContainText('overlap');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/planner-conflict.png`, fullPage: true });

  // A block placed during the shift is called out.
  await page.getByRole('button', { name: 'Add block' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a block' });
  await dialog.getByLabel('Goal').selectOption({ label: 'Game' });
  await dialog.getByLabel('From').fill('17:00');
  await dialog.getByLabel('To').fill('18:00');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('region', { name: 'Conflicts' })).toContainText(
    '“Game development” overlaps your shift',
  );

  // Re-proposing keeps blocks you moved or added; Clear proposed removes the rest.
  await page.getByRole('button', { name: 'Propose a plan' }).click();
  await expect(today.getByRole('button', { name: /^Study, Thu 11:20 to 12:20/ })).toBeVisible();
  await page.getByRole('button', { name: 'Discard' }).click();
  await page.getByRole('button', { name: 'Clear proposed' }).click();
  await expect(page.getByTestId('plan-block')).toHaveCount(2);

  // Editing a block: mark the study block done (which also logs the study time).
  await today.getByRole('button', { name: /^Study, Thu 11:20 to 12:20/ }).press('Enter');
  const edit = page.getByRole('dialog', { name: 'Edit block' });
  await edit.getByRole('switch', { name: 'Done' }).click();
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(
    today.getByRole('button', { name: /^Study, Thu 11:20 to 12:20, done/ }),
  ).toBeVisible();
  const logged = await page.evaluate(async () => {
    const r = await window.ledger.invoke('study.list', { from: '2026-10-15', to: '2026-10-15' });
    return r.ok ? r.data.map((s) => s.minutes) : [];
  });
  expect(logged).toEqual([60]);

  expect(await networkLog(page)).toEqual([]);
  await app.close();
});

test('Today, habits and the weekly review', async () => {
  const { app, page, userData } = await launchApp();
  await completeOnboarding(page);
  const nav = page.getByRole('navigation', { name: 'Sections' });

  // Today's focus: revision first (juz 16–30 are memorised), sized to the time chosen.
  const focus = page.getByRole('region', { name: 'Today’s focus' });
  const actions = focus.getByRole('list', { name: 'Suggested actions' });
  await expect(actions.getByRole('listitem').first()).toContainText(/Revise \d+ pages/);
  await focus.getByText('15m', { exact: true }).click();
  // Onboarding recorded today's weigh-in, so 15 minutes is all revision.
  await expect(actions.getByRole('listitem')).toHaveCount(1);
  await expect(actions.getByRole('listitem')).toContainText('15 min');
  await focus.getByText('2h', { exact: true }).click();
  await expect(
    actions.getByRole('listitem').filter({ hasText: 'Full-body training' }),
  ).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/today-focus.png`, fullPage: true });

  // Habits: add one, tick it on Today.
  await nav.getByRole('link', { name: 'Weekly review' }).click();
  await page
    .getByRole('navigation', { name: 'Review sections' })
    .getByRole('link', { name: 'Habits' })
    .click();
  await expect(page.getByText('No habits yet')).toBeVisible();
  await page.getByLabel('Habit', { exact: true }).fill('Phone outside the bedroom');
  await page.getByRole('button', { name: 'Add habit' }).click();
  await expect(page.getByText('Phone outside the bedroom')).toBeVisible();
  await page.getByRole('button', { name: 'Phone outside the bedroom on Wed 14 Oct' }).click();
  await expect(
    page.getByRole('button', { name: 'Phone outside the bedroom on Wed 14 Oct' }),
  ).toHaveAttribute('aria-pressed', 'true');
  // One grace day a week: missing today would not break it, so it is not "at risk".
  await expect(page.getByText('1-day streak')).toBeVisible();
  await expect(page.getByText('At risk today')).toHaveCount(0);

  await nav.getByRole('link', { name: 'Today' }).click();
  const habits = page.getByRole('region', { name: 'Habits' });
  await habits.getByRole('checkbox', { name: /Phone outside the bedroom/ }).check();
  await expect(habits).toContainText('2-day streak');

  // The weekly review for this week (Thursday: the current week).
  await nav.getByRole('link', { name: 'Weekly review' }).click();
  await expect(page.getByRole('region', { name: 'The week in figures' })).toContainText(
    '1 weigh-in',
  );
  await page.getByLabel('What went well?').fill('Revision every day');
  await page.getByLabel('Priority 1').fill('Finish the engine tutorial');
  await page.getByLabel('Priority 2').fill('Two training sessions');
  await page.getByRole('button', { name: 'Complete review' }).click();
  await expect(page.getByText('Reviewed')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Review sections' })
    .getByRole('link', { name: 'History' })
    .click();
  await expect(page.getByRole('article', { name: 'Week of 12 Oct 2026' })).toContainText(
    'Revision every day',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/review-history.png`, fullPage: true });
  expect(await networkLog(page)).toEqual([]);
  await app.close();

  // Next Monday: the priorities set in the review appear on Today.
  const next = await launchApp({ userData, now: '2026-10-19T08:00:00' });
  const priorities = next.page.getByRole('region', { name: 'This week’s priorities' });
  await expect(priorities).toContainText('Finish the engine tutorial');
  await expect(priorities).toContainText('Two training sessions');
  await expect(next.page.getByText('Last week has not been reviewed yet.')).toHaveCount(0);
  expect(await networkLog(next.page)).toEqual([]);
  await next.app.close();
});
