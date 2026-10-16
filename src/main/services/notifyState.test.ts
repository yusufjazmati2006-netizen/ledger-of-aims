import { describe, expect, it } from 'vitest';
import { assessmentInputSchema, moduleInputSchema } from '@shared/schemas/degree';
import { createTestContext } from '../db/testing';
import { setShiftDays } from '../db/repositories/shifts';
import { upsertWeighIn } from '../db/repositories/weighIns';
import { createAssessment, createModule, degreeData } from '../db/repositories/degree';
import { startTimer } from '../db/repositories/game';
import { gatherNotifyState, recordSent, sentKeys } from './notifyState';

describe('gatherNotifyState', () => {
  it('reads today’s state for the reminder rules', () => {
    const ctx = createTestContext('2026-10-15T10:30:00');
    setShiftDays(ctx, [{ date: '2026-10-14', shiftTypeId: 'night' }]);
    upsertWeighIn(ctx, { date: '2026-10-15', weightKg: 66.4, note: '' });
    const year = degreeData(ctx).years[0];
    if (!year) throw new Error('no seeded year');
    const mod = createModule(
      ctx,
      moduleInputSchema.parse({ yearId: year.id, title: 'Marketing', credits: 20 }),
    );
    createAssessment(
      ctx,
      assessmentInputSchema.parse({
        moduleId: mod.id,
        title: 'Essay',
        weight: 50,
        dueDate: '2026-10-18',
      }),
    );
    createAssessment(
      ctx,
      assessmentInputSchema.parse({
        moduleId: mod.id,
        title: 'Done already',
        weight: 50,
        dueDate: '2026-10-18',
        status: 'submitted',
      }),
    );
    startTimer(ctx, 'paddles');

    const s = gatherNotifyState(ctx);
    expect(s).toMatchObject({
      today: '2026-10-15',
      minute: 10 * 60 + 30,
      weighedToday: true,
      revisedToday: false,
      trainingDue: true,
      weekEndsToday: false,
      reviewDone: false,
      deadlines: [expect.objectContaining({ title: 'Essay', due: '2026-10-18' })],
    });
    expect(s.runningTimer?.note).toBe('paddles');
    expect(s.deadlines).toHaveLength(1);
    // After a night shift ending 01:00, the day starts at 10:20.
    expect(s.frame?.wake).toBe(620);
  });

  it('remembers what was sent', () => {
    const ctx = createTestContext();
    recordSent(ctx, { key: 'revision:2026-10-15', title: 'x', body: '', path: '/' });
    recordSent(ctx, { key: 'revision:2026-10-15', title: 'x', body: '', path: '/' });
    expect([...sentKeys(ctx)]).toEqual(['revision:2026-10-15']);
  });
});
