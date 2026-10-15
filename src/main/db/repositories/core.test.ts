import { describe, expect, it } from 'vitest';
import { SEED_MILESTONES } from '@shared/seed/defaults';
import { createTestContext } from '../testing';
import { seedDatabase } from '../seed';
import { getAllSettings, getSettings, updateSettings } from './settings';
import { listGoals, updateGoal } from './goals';
import {
  createMilestone,
  deleteMilestone,
  listMilestones,
  reorderMilestones,
  setMilestoneCompleted,
  updateMilestone,
} from './milestones';
import { listShiftDays, listShiftTypes, setShiftDays, updateShiftType } from './shifts';
import { deleteWeighIn, listWeighIns, upsertWeighIn } from './weighIns';
import { DomainError } from '../../errors';

describe('seeding', () => {
  it('creates goals, milestones and shift types once', () => {
    const ctx = createTestContext();
    expect(listGoals(ctx)).toHaveLength(4);
    expect(listMilestones(ctx)).toHaveLength(SEED_MILESTONES.length);
    expect(listShiftTypes(ctx)).toHaveLength(3);
    expect(seedDatabase(ctx).seeded).toEqual([]);
    expect(listMilestones(ctx)).toHaveLength(SEED_MILESTONES.length);
  });

  it('does not restore milestones the user deleted', () => {
    const ctx = createTestContext();
    for (const m of listMilestones(ctx, 'game')) deleteMilestone(ctx, m.id);
    seedDatabase(ctx);
    // Other goals' milestones still exist, so the table is not empty and nothing is re-added.
    expect(listMilestones(ctx, 'game')).toHaveLength(0);
  });
});

describe('settings', () => {
  it('returns defaults when nothing is stored', () => {
    const ctx = createTestContext();
    const s = getAllSettings(ctx);
    expect(s.general).toMatchObject({ theme: 'system', units: 'kg', weekStartsOn: 1 });
    expect(s.onboarding.completedAt).toBeNull();
  });

  it('merges patches and validates the result', () => {
    const ctx = createTestContext();
    updateSettings(ctx, 'general', { units: 'lb' });
    updateSettings(ctx, 'general', { theme: 'dark' });
    expect(getSettings(ctx, 'general')).toMatchObject({ units: 'lb', theme: 'dark' });
    expect(() => updateSettings(ctx, 'general', { weekStartsOn: 9 })).toThrow();
    expect(getSettings(ctx, 'general').weekStartsOn).toBe(1);
  });

  it('survives a corrupt stored value by falling back to defaults', () => {
    const ctx = createTestContext();
    ctx.db
      .prepare(
        "INSERT INTO settings (namespace, value, updated_at) VALUES ('general', '{not json', 'x')",
      )
      .run();
    expect(getSettings(ctx, 'general').theme).toBe('system');
  });
});

describe('goals and milestones', () => {
  it('updates the next single action', () => {
    const ctx = createTestContext();
    const goal = updateGoal(ctx, 'game', { nextAction: 'Install Godot' });
    expect(goal.nextAction).toBe('Install Godot');
  });

  it('creates, edits, completes, reorders and deletes milestones', () => {
    const ctx = createTestContext();
    const created = createMilestone(ctx, {
      goalId: 'degree',
      title: 'Level 4 complete',
      targetDate: '2027-09-30',
      targetValue: null,
      unit: null,
      kind: 'milestone',
      notes: '',
    });
    expect(created.sortOrder).toBe(1);
    expect(updateMilestone(ctx, created.id, { title: 'Year one complete' }).title).toBe(
      'Year one complete',
    );
    expect(setMilestoneCompleted(ctx, created.id, true).completedAt).toEqual(expect.any(String));
    expect(setMilestoneCompleted(ctx, created.id, false).completedAt).toBeNull();

    const ids = listMilestones(ctx, 'degree').map((m) => m.id);
    const reversed = [...ids].reverse();
    expect(reorderMilestones(ctx, 'degree', reversed).map((m) => m.id)).toEqual(reversed);
    expect(() => reorderMilestones(ctx, 'degree', ids.slice(1))).toThrow(DomainError);

    deleteMilestone(ctx, created.id);
    expect(() => {
      deleteMilestone(ctx, created.id);
    }).toThrow(DomainError);
  });
});

describe('shifts', () => {
  it('sets, replaces and clears shift days', () => {
    const ctx = createTestContext();
    setShiftDays(ctx, [
      { date: '2026-10-15', shiftTypeId: 'morning' },
      { date: '2026-10-16', shiftTypeId: 'night' },
    ]);
    setShiftDays(ctx, [{ date: '2026-10-15', shiftTypeId: 'off' }]);
    expect(listShiftDays(ctx, '2026-10-01', '2026-10-31')).toEqual([
      { date: '2026-10-15', shiftTypeId: 'off' },
      { date: '2026-10-16', shiftTypeId: 'night' },
    ]);
    setShiftDays(ctx, [{ date: '2026-10-16', shiftTypeId: null }]);
    expect(listShiftDays(ctx, '2026-10-01', '2026-10-31')).toHaveLength(1);
    expect(() => setShiftDays(ctx, [{ date: '2026-10-17', shiftTypeId: 'graveyard' }])).toThrow(
      DomainError,
    );
  });

  it('edits shift hours but protects the off type', () => {
    const ctx = createTestContext();
    expect(updateShiftType(ctx, 'night', { end: '01:30' }).end).toBe('01:30');
    expect(() => updateShiftType(ctx, 'off', { start: '09:00' })).toThrow(DomainError);
    expect(() => updateShiftType(ctx, 'morning', { start: '16:30' })).toThrow(DomainError);
  });
});

describe('weigh-ins', () => {
  it('keeps one weigh-in per day', () => {
    const ctx = createTestContext();
    upsertWeighIn(ctx, { date: '2026-10-15', weightKg: 66.4, note: '' });
    const replaced = upsertWeighIn(ctx, {
      date: '2026-10-15',
      weightKg: 66.25,
      note: 'after coffee',
    });
    upsertWeighIn(ctx, { date: '2026-10-17', weightKg: 66.6, note: '' });
    const all = listWeighIns(ctx);
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({ weightKg: 66.25, note: 'after coffee' });
    expect(listWeighIns(ctx, { from: '2026-10-16' })).toHaveLength(1);
    deleteWeighIn(ctx, replaced.id);
    expect(listWeighIns(ctx)).toHaveLength(1);
  });
});
