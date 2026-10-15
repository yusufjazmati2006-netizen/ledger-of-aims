import type { RepoContext } from '../../db/repositories/context';
import { getAllSettings, updateSettings } from '../../db/repositories/settings';
import { listGoals, updateGoal } from '../../db/repositories/goals';
import {
  createMilestone,
  deleteMilestone,
  listMilestones,
  reorderMilestones,
  setMilestoneCompleted,
  updateMilestone,
} from '../../db/repositories/milestones';
import {
  listShiftDays,
  listShiftTypes,
  setShiftDays,
  updateShiftType,
} from '../../db/repositories/shifts';
import { deleteWeighIn, listWeighIns, upsertWeighIn } from '../../db/repositories/weighIns';
import type { PartialHandlerTable } from '../types';

export function coreHandlers(ctx: RepoContext): PartialHandlerTable {
  return {
    'settings.get': () => getAllSettings(ctx),
    'settings.update': (input) => {
      // The discriminated union guarantees `patch` matches `namespace`.
      updateSettings(ctx, input.namespace, input.patch as never);
      return getAllSettings(ctx);
    },

    'goals.list': () => listGoals(ctx),
    'goals.update': ({ id, patch }) => updateGoal(ctx, id, patch),

    'milestones.list': () => listMilestones(ctx),
    'milestones.create': (input) => createMilestone(ctx, input),
    'milestones.update': ({ id, patch }) => updateMilestone(ctx, id, patch),
    'milestones.delete': ({ id }) => {
      deleteMilestone(ctx, id);
      return null;
    },
    'milestones.reorder': ({ goalId, orderedIds }) => reorderMilestones(ctx, goalId, orderedIds),
    'milestones.setCompleted': ({ id, completed }) => setMilestoneCompleted(ctx, id, completed),

    'shifts.types': () => listShiftTypes(ctx),
    'shifts.updateType': ({ id, patch }) => updateShiftType(ctx, id, patch),
    'shifts.range': ({ from, to }) => listShiftDays(ctx, from, to),
    'shifts.set': ({ days }) => setShiftDays(ctx, days),

    'weighIns.list': (range) => listWeighIns(ctx, range),
    'weighIns.upsert': (input) => upsertWeighIn(ctx, input),
    'weighIns.delete': ({ id }) => {
      deleteWeighIn(ctx, id);
      return null;
    },

    'onboarding.complete': (input) => {
      const today = ctx.clock.today();
      ctx.db.transaction(() => {
        updateSettings(ctx, 'general', { units: input.units });
        updateSettings(ctx, 'profile', { startWeightKg: input.startWeightKg, startDate: today });
        upsertWeighIn(ctx, { date: today, weightKg: input.startWeightKg, note: 'Starting weight' });
        if (input.weekShifts.length > 0) setShiftDays(ctx, input.weekShifts);
        updateSettings(ctx, 'onboarding', { completedAt: ctx.clock.nowIso() });
      })();
      return getAllSettings(ctx);
    },
  };
}
