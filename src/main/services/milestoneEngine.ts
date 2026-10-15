import { buildLayout } from '@shared/domain/quran/mushaf';
import { isLearned, juzCompletionOrder, pagesForJuzCount } from '@shared/domain/quran/progress';
import type { Milestone } from '@shared/schemas/core';
import type { RepoContext } from '../db/repositories/context';
import { listMilestones, setMilestoneCompleted } from '../db/repositories/milestones';
import { listPages } from '../db/repositories/quran';
import { getSettings } from '../db/repositories/settings';

/**
 * Completes quantitative Quran milestones ("25 juz") as soon as the learned pages
 * reach them. Returns the milestones completed by this call so the renderer can
 * celebrate them. Milestones are never un-completed automatically.
 */
export function checkQuranMilestones(ctx: RepoContext): Milestone[] {
  const open = listMilestones(ctx, 'quran').filter(
    (m) => m.completedAt === null && m.targetValue !== null && m.unit === 'juz',
  );
  if (open.length === 0) return [];
  const settings = getSettings(ctx, 'quran');
  if (!settings.setupOn) return [];
  const layout = buildLayout(settings.juzStartPages);
  const { records } = listPages(ctx);
  const learned = records.filter(isLearned).length;
  const order = juzCompletionOrder(records, layout, settings.direction);
  return open
    .filter((m) => learned >= Math.round(pagesForJuzCount(m.targetValue ?? 0, order, layout)))
    .map((m) => setMilestoneCompleted(ctx, m.id, true));
}
