import { buildLayout, pagesOfJuz } from '@shared/domain/quran/mushaf';
import { nextPagesToLearn } from '@shared/domain/quran/progress';
import {
  blankPage,
  flagForRevision,
  learnPage,
  loadMapOf,
  markMemorized,
  resetPage,
  reviewMany,
  seedMemorizedPages,
  type PageRecord,
  type PageState,
  type Rating,
} from '@shared/domain/quran/scheduler';
import type { QuranSettings } from '@shared/schemas/settings';
import type { QuranMutation } from '@shared/schemas/quran';
import { DomainError } from '../errors';
import type { RepoContext } from '../db/repositories/context';
import { newId } from '../db/repositories/context';
import { getSettings, updateSettings } from '../db/repositories/settings';
import {
  deleteReviewBatch,
  getPageRecords,
  insertReviews,
  listPages,
  savePages,
} from '../db/repositories/quran';
import { checkQuranMilestones } from './milestoneEngine';

/**
 * Quran use-cases. The scheduling rules live in the shared, pure domain module;
 * this service loads records, applies those rules, persists the result in one
 * transaction, and reports what changed (so the renderer can offer Undo).
 */
function context(ctx: RepoContext) {
  const settings = getSettings(ctx, 'quran');
  return { settings, layout: buildLayout(settings.juzStartPages), params: settings.scheduler };
}

function mutate(
  ctx: RepoContext,
  change: (
    all: PageRecord[],
    settings: QuranSettings,
  ) => { before: PageRecord[]; after: PageRecord[]; rating?: Rating },
): QuranMutation {
  const batchId = newId();
  return ctx.db.transaction(() => {
    const { settings } = context(ctx);
    const all = listPages(ctx).records;
    const { before, after, rating } = change(all, settings);
    savePages(ctx, after);
    if (rating) insertReviews(ctx, batchId, rating, before, after);
    const completedMilestones = checkQuranMilestones(ctx);
    return { batchId, before, after, completedMilestones };
  })();
}

/** Daily revision capacity in pages, from the configured time and minutes per page. */
export function dailyCapacity(settings: QuranSettings): number {
  return Math.max(
    1,
    Math.floor(settings.revisionMinutesPerDay / Math.max(0.5, settings.minutesPerPage)),
  );
}

/** Records which juz were already memorised and seeds their revision schedule. */
export function setupMushaf(
  ctx: RepoContext,
  input: { juz: number[]; direction: 'forward' | 'backward' },
): QuranMutation {
  const result = mutate(ctx, (all, settings) => {
    const { layout, params } = context(ctx);
    const pages = [...new Set(input.juz)].flatMap((j) => pagesOfJuz(layout, j));
    const seeded = new Map(
      seedMemorizedPages(pages, ctx.clock.today(), dailyCapacity(settings), params).map((r) => [
        r.page,
        r,
      ]),
    );
    const after = all.map((r) => seeded.get(r.page) ?? blankPage(r.page));
    return { before: all, after };
  });
  updateSettings(ctx, 'quran', { setupOn: ctx.clock.today(), direction: input.direction });
  return result;
}

/** Marks the next `count` pages in learning order as learned today. */
export function learnNextPages(ctx: RepoContext, count: number): QuranMutation {
  return mutate(ctx, (all, settings) => {
    const { layout, params } = context(ctx);
    const pages = nextPagesToLearn(all, layout, settings.direction, count);
    if (pages.length === 0) throw new DomainError('CONFLICT', 'Every page is already learned.');
    const before = all.filter((r) => pages.includes(r.page));
    return { before, after: before.map((r) => learnPage(r, ctx.clock.today(), params)) };
  });
}

/** Sets the state of specific pages from the mushaf grid. */
export function setPageStates(ctx: RepoContext, pages: number[], state: PageState): QuranMutation {
  return mutate(ctx, (all) => {
    const { params } = context(ctx);
    const today = ctx.clock.today();
    const targets = new Set(pages);
    const before = all.filter((r) => targets.has(r.page) && r.state !== state);
    const load = loadMapOf(all, targets);
    const after = before
      .filter((r) => !(state === 'revision' && r.state === 'not_started'))
      .map((r) => {
        switch (state) {
          case 'new':
            return learnPage(r, today, params);
          case 'memorized': {
            const next = markMemorized(r, today, params, load);
            if (next.dueOn) load.set(next.dueOn, (load.get(next.dueOn) ?? 0) + 1);
            return next;
          }
          case 'revision':
            return flagForRevision(r, today, params);
          case 'not_started':
            return resetPage(r);
        }
      });
    const changed = new Set(after.map((r) => r.page));
    return { before: before.filter((r) => changed.has(r.page)), after };
  });
}

/** Applies a revision rating to one or more learned pages. */
export function reviewPages(ctx: RepoContext, pages: number[], rating: Rating): QuranMutation {
  return mutate(ctx, (all) => {
    const { params } = context(ctx);
    const targets = new Set(pages);
    const before = all.filter((r) => targets.has(r.page) && r.state !== 'not_started');
    if (before.length === 0) {
      throw new DomainError('CONFLICT', 'Only learned pages can be reviewed.');
    }
    const after = reviewMany(before, rating, ctx.clock.today(), params, all);
    return { before, after, rating };
  });
}

/** Restores pages to their state before a mutation and removes its review entries. */
export function undoMutation(ctx: RepoContext, batchId: string, before: PageRecord[]): void {
  ctx.db.transaction(() => {
    const existing = new Set(
      getPageRecords(
        ctx,
        before.map((r) => r.page),
      ).map((r) => r.page),
    );
    savePages(
      ctx,
      before.filter((r) => existing.has(r.page)),
    );
    deleteReviewBatch(ctx, batchId);
  })();
}
