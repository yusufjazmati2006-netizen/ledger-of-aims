import type { RepoContext } from '../../db/repositories/context';
import { applyProposal, clearProposed } from '../../db/repositories/plan';
import {
  checkHabit,
  deleteHabit,
  getReview,
  habitsData,
  listReviews,
  saveHabit,
  saveReview,
  weekMetrics,
} from '../../db/repositories/review';
import type { PartialHandlerTable } from '../types';

export function planningHandlers(ctx: RepoContext): PartialHandlerTable {
  return {
    'plan.apply': ({ from, to, blocks }) => applyProposal(ctx, from, to, blocks),
    'plan.clearProposed': ({ from, to }) => clearProposed(ctx, from, to),
    'review.get': ({ weekStart }) => getReview(ctx, weekStart),
    'review.list': () => listReviews(ctx),
    'review.metrics': ({ weekStart }) => weekMetrics(ctx, weekStart),
    'review.save': (input) => saveReview(ctx, input),
    'habits.data': ({ from, to }) => habitsData(ctx, from, to),
    'habits.save': (input) => saveHabit(ctx, input),
    'habits.delete': ({ id }) => {
      deleteHabit(ctx, id);
      return null;
    },
    'habits.check': ({ habitId, date, done }) => {
      checkHabit(ctx, habitId, date, done);
      return null;
    },
  };
}
