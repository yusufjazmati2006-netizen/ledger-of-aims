import { useMemo } from 'react';
import { buildLayout, type MushafLayout } from '@shared/domain/quran/mushaf';
import { computePace, trackingStartDate, type PaceResult } from '@shared/domain/quran/pace';
import { juzSummaries, nextPagesToLearn, type JuzSummary } from '@shared/domain/quran/progress';
import { buildQueue, type RevisionQueue } from '@shared/domain/quran/queue';
import type { PageRecord } from '@shared/domain/quran/scheduler';
import { computeStreak, type StreakResult } from '@shared/domain/streaks/streaks';
import { addDays } from '@shared/domain/time/localDate';
import type { QuranSettings } from '@shared/schemas/settings';
import type { ReviewEntry } from '@shared/schemas/quran';
import { useSettings, useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';

export interface QuranView {
  ready: boolean;
  setUp: boolean;
  today: string;
  settings: QuranSettings;
  layout: MushafLayout;
  records: PageRecord[];
  notes: Record<number, string>;
  reviews: ReviewEntry[];
  queue: RevisionQueue | null;
  pace: PaceResult | null;
  juz: JuzSummary[];
  streak: StreakResult | null;
  nextPages: number[];
  availableMinutes: number;
}

/**
 * Everything the Quran screens (and the Today card) need, derived from the stored
 * pages with the shared domain functions. Recomputed only when inputs change.
 */
export function useQuran(): QuranView {
  const today = useToday();
  const settings = useSettings();
  const q = settings.quran;
  const pages = useLedger('quran.pages', undefined, { domains: ['quran'] });
  const milestones = useLedger('milestones.list', undefined, { domains: ['milestones'] });
  const reviews = useLedger(
    'quran.reviews',
    { from: addDays(today, -180), to: today },
    { domains: ['quran'] },
  );
  const layout = useMemo(() => buildLayout(q.juzStartPages), [q.juzStartPages]);
  const availableMinutes =
    q.todayMinutes?.date === today ? q.todayMinutes.minutes : q.revisionMinutesPerDay;

  const derived = useMemo(() => {
    const records = pages.data?.records ?? [];
    if (records.length === 0) return null;
    const quranMilestones = (milestones.data ?? [])
      .filter((m) => m.goalId === 'quran' && m.unit === 'juz' && m.targetValue !== null)
      .map((m) => ({
        date: m.targetDate,
        juz: m.targetValue ?? 0,
        completed: m.completedAt !== null,
      }));
    const reviewDates = new Set((reviews.data ?? []).map((r) => r.reviewedOn));
    return {
      queue: buildQueue(records, today, layout, {
        availableMinutes,
        minutesPerPage: q.minutesPerPage,
      }),
      pace: computePace({
        records,
        layout,
        direction: q.direction,
        today,
        planStart: settings.general.planStartDate,
        trackingStart: trackingStartDate(settings.general.planStartDate, q.setupOn),
        milestones: quranMilestones,
        baselinePerWeek: q.baselinePagesPerWeek,
        tolerancePages: q.tolerancePages,
      }),
      juz: juzSummaries(records, layout, today),
      streak: computeStreak(reviewDates, today, { graceDays: q.streakGraceDays, windowDays: 7 }),
      nextPages: nextPagesToLearn(records, layout, q.direction, 10),
    };
  }, [
    pages.data,
    milestones.data,
    reviews.data,
    today,
    layout,
    availableMinutes,
    q,
    settings.general.planStartDate,
  ]);

  return {
    ready: pages.data !== undefined,
    setUp: q.setupOn !== null,
    today,
    settings: q,
    layout,
    records: pages.data?.records ?? [],
    notes: pages.data?.notes ?? {},
    reviews: reviews.data ?? [],
    queue: derived?.queue ?? null,
    pace: derived?.pace ?? null,
    juz: derived?.juz ?? [],
    streak: derived?.streak ?? null,
    nextPages: derived?.nextPages ?? [],
    availableMinutes,
  };
}
