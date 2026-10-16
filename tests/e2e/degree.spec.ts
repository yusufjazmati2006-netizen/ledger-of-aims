import { completeOnboarding, expect, launchApp, networkLog, test } from './harness';

test('Degree: modules, deadlines, projection, what-I-need, calendar and shift-aware study', async () => {
  const { app, page } = await launchApp();
  await completeOnboarding(page);
  // Yesterday was a night shift (16:00–01:00), so nothing may be planned before 10:20 today.
  await page.evaluate(async () => {
    await window.ledger.invoke('shifts.set', {
      days: [{ date: '2026-10-14', shiftTypeId: 'night' }],
    });
  });

  await page.getByRole('link', { name: 'Degree' }).click();
  const tabs = page.getByRole('navigation', { name: 'Degree sections' });
  await expect(page.getByText('No deadlines yet')).toBeVisible();

  // A Level 5 module from the 50/50 template.
  await tabs.getByRole('link', { name: 'Modules' }).click();
  const year2 = page.getByRole('region', { name: 'Year 2 (Level 5)' });
  await year2.getByRole('button', { name: 'Add module' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add module' });
  await dialog.getByLabel('Code').fill('BM5010');
  await dialog.getByLabel('Title').fill('Marketing Principles');
  await dialog
    .getByLabel('Assessment template')
    .selectOption({ label: 'Coursework 50% + exam 50%' });
  await dialog.getByRole('button', { name: 'Save' }).click();
  const module = page.getByRole('group', { name: 'Module Marketing Principles' });
  await expect(module.getByRole('button', { name: 'Edit Coursework' })).toBeVisible();
  await expect(year2.getByText('20 / 120 credits')).toBeVisible();

  // Due date on the coursework; grade on the exam.
  await module.getByRole('button', { name: 'Edit Coursework' }).click();
  await page
    .getByRole('dialog', { name: 'Edit assessment' })
    .getByLabel('Due date')
    .fill('2026-10-20');
  await page
    .getByRole('dialog', { name: 'Edit assessment' })
    .getByRole('button', { name: 'Save' })
    .click();
  await module.getByRole('button', { name: 'Edit Exam' }).click();
  await page
    .getByRole('dialog', { name: 'Edit assessment' })
    .getByLabel('Grade', { exact: true })
    .fill('72');
  await page
    .getByRole('dialog', { name: 'Edit assessment' })
    .getByRole('button', { name: 'Save' })
    .click();
  await expect(module.getByText('Module mark 72.0% so far')).toBeVisible();

  // Overview: an escalated countdown, the projection and the requirement.
  await tabs.getByRole('link', { name: 'Overview' }).click();
  const countdown = page.locator('[data-urgency]').first();
  await expect(countdown).toHaveAttribute('data-urgency', 'near');
  await expect(countdown).toContainText('5 days');
  await expect(page.getByTestId('projected-mark')).toHaveText('72.0%');
  // 70 = banked 2.0 + (35/36)·x → x ≈ 69.9
  await expect(page.getByText('69.9% average needed')).toBeVisible();

  // What-if: a hypothetical coursework mark moves the projection.
  await page.getByLabel('What-if mark for Coursework').fill('60');
  await expect(page.getByText('With these marks: 66.0% — 2:1')).toBeVisible();

  // Calendar shows the deadline.
  await tabs.getByRole('link', { name: 'Calendar' }).click();
  await expect(
    page.getByRole('gridcell', { name: /20 Oct 2026: BM5010 · Coursework/ }),
  ).toBeVisible();

  // Study: proposals respect the night shift; accept and complete one.
  await tabs.getByRole('link', { name: 'Study' }).click();
  const proposals = page.getByRole('region', { name: 'Suggested sessions' });
  const todayRow = proposals.getByRole('listitem').filter({ hasText: 'Today' }).first();
  await expect(todayRow).toContainText('10:20–11:20');
  await todayRow.getByRole('button', { name: 'Add to plan' }).click();
  const planned = page.getByRole('region', { name: 'Planned study' });
  await expect(planned.getByText('10:20–11:20')).toBeVisible();
  await planned.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Logged 1 h of study.')).toBeVisible();
  await expect(page.getByText('1.0', { exact: true })).toBeVisible();

  // Today's card names the next deadline.
  await page.getByRole('link', { name: 'Today' }).click();
  const card = page.getByRole('article', { name: 'Business management degree' });
  await expect(card.getByText('5 days')).toBeVisible();
  await expect(card.getByText('Projected First · 72%')).toBeVisible();

  expect(await networkLog(page)).toEqual([]);
  await app.close();
});
