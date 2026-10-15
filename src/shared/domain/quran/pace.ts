import { interpolateAt, slopeAt, type DatedValue } from '../math/interpolate';
import { addDays, diffDays, maxDate, startOfWeek, type LocalDate } from '../time/localDate';
import { PAGES_PER_JUZ, TOTAL_PAGES, type MushafLayout } from './mushaf';
import { isLearned, juzCompletionOrder, pagesForJuzCount, type Direction } from './progress';
import type { PageRecord } from './scheduler';

export type Verdict = 'ahead' | 'on-track' | 'behind';

export interface QuranMilestoneTarget {
  date: LocalDate;
  juz: number;
  completed?: boolean;
}

export interface PaceInputs {
  records: readonly PageRecord[];
  layout: MushafLayout;
  direction: Direction;
  today: LocalDate;
  /** The plan start (15 Oct 2026): the target line is anchored here. */
  planStart: LocalDate;
  /** When page-by-page tracking began (the mushaf set-up date). */
  trackingStart: LocalDate;
  milestones: readonly QuranMilestoneTarget[];
  baselinePerWeek: number;
  tolerancePages: number;
}

export interface PaceResult {
  learned: number;
  juzEquivalent: number;
  remaining: number;
  /** Pages learned in the last 28 days (actual, not blended). */
  learnedLast28: number;
  /** Rolling 4-week pace in pages per week (blended with the baseline while data is short). */
  pacePerWeek: number;
  blended: boolean;
  daysTracked: number;
  targetToday: number;
  /** Pages ahead (+) or behind (−) the target line today, rounded to whole pages. */
  deficit: number;
  verdict: Verdict;
  /** Target pace on today's segment of the plan, pages per week. */
  targetPacePerWeek: number;
  /** The deficit expressed in weeks of target pace. */
  weeksEquivalent: number;
  next: {
    date: LocalDate;
    juz: number;
    pages: number;
    pagesToGo: number;
    daysLeft: number;
    requiredPerWeek: number;
  } | null;
  projectedCompletion: LocalDate | null;
  finalTarget: { date: LocalDate; pages: number } | null;
  /** Days the projection lands after (+) or before (−) the final target. */
  projectedSlipDays: number | null;
  targetLine: DatedValue[];
}

/** Pages already learned before the plan started (or with no learning date). */
export function startingPages(records: readonly PageRecord[], planStart: LocalDate): number {
  return records.filter((r) => isLearned(r) && (r.learnedOn === null || r.learnedOn < planStart))
    .length;
}

export function computePace(input: PaceInputs): PaceResult {
  const { records, layout, direction, today } = input;
  const learned = records.filter(isLearned).length;
  const remaining = TOTAL_PAGES - learned;

  // Rolling four weeks. Until 28 days of tracking exist, the missing days are filled
  // with the declared baseline so the first weeks are neither 0 nor wildly noisy.
  const windowStart = addDays(today, -27);
  const learnedLast28 = records.filter(
    (r) => r.learnedOn !== null && r.learnedOn >= windowStart && r.learnedOn <= today,
  ).length;
  const daysTracked = Math.min(28, Math.max(0, diffDays(input.trackingStart, today) + 1));
  const missingDays = 28 - daysTracked;
  const pacePerWeek = (learnedLast28 + (input.baselinePerWeek / 7) * missingDays) / 4;

  // Target line: from the plan start through each milestone, in pages.
  const order = juzCompletionOrder(records, layout, direction);
  const anchor = startingPages(records, input.planStart);
  const milestones = [...input.milestones].sort((a, b) => a.date.localeCompare(b.date));
  const targetLine: DatedValue[] = [
    { date: input.planStart, value: anchor },
    ...milestones
      .filter((m) => m.date > input.planStart)
      .map((m) => ({ date: m.date, value: pagesForJuzCount(m.juz, order, layout) })),
  ];
  const targetToday = interpolateAt(targetLine, today) ?? anchor;
  const deficit = Math.round(learned - targetToday);
  const verdict: Verdict =
    Math.abs(deficit) <= input.tolerancePages ? 'on-track' : deficit > 0 ? 'ahead' : 'behind';
  const targetPacePerWeek = slopeAt(targetLine, today) * 7;
  const weeksEquivalent = targetPacePerWeek > 0 ? deficit / targetPacePerWeek : 0;

  const nextMilestone = milestones.find((m) => !m.completed && m.date >= today);
  let next: PaceResult['next'] = null;
  if (nextMilestone) {
    const pages = Math.round(pagesForJuzCount(nextMilestone.juz, order, layout));
    const daysLeft = diffDays(today, nextMilestone.date);
    const pagesToGo = Math.max(0, pages - learned);
    next = {
      date: nextMilestone.date,
      juz: nextMilestone.juz,
      pages,
      pagesToGo,
      daysLeft,
      requiredPerWeek: daysLeft > 0 ? (pagesToGo / daysLeft) * 7 : pagesToGo,
    };
  }

  const last = milestones[milestones.length - 1];
  const finalTarget = last
    ? { date: last.date, pages: Math.round(pagesForJuzCount(last.juz, order, layout)) }
    : null;
  const projectedCompletion =
    remaining === 0
      ? today
      : pacePerWeek > 0
        ? addDays(today, Math.ceil((remaining / pacePerWeek) * 7))
        : null;
  const projectedSlipDays =
    projectedCompletion && finalTarget ? diffDays(finalTarget.date, projectedCompletion) : null;

  return {
    learned,
    juzEquivalent: learned / PAGES_PER_JUZ,
    remaining,
    learnedLast28,
    pacePerWeek,
    blended: missingDays > 0,
    daysTracked,
    targetToday,
    deficit,
    verdict,
    targetPacePerWeek,
    weeksEquivalent,
    next,
    projectedCompletion,
    finalTarget,
    projectedSlipDays,
    targetLine,
  };
}

/** Pages learned per week for the `weeks` weeks ending with the current one. */
export function weeklyLearned(
  records: readonly PageRecord[],
  today: LocalDate,
  weeks: number,
  weekStartsOn: number,
): { weekStart: LocalDate; pages: number }[] {
  const current = startOfWeek(today, weekStartsOn);
  const starts = Array.from({ length: weeks }, (_, i) => addDays(current, -7 * (weeks - 1 - i)));
  const counts = new Map(starts.map((s) => [s, 0]));
  for (const r of records) {
    if (!r.learnedOn) continue;
    const ws = startOfWeek(r.learnedOn, weekStartsOn);
    if (counts.has(ws)) counts.set(ws, (counts.get(ws) ?? 0) + 1);
  }
  return starts.map((weekStart) => ({ weekStart, pages: counts.get(weekStart) ?? 0 }));
}

/** Cumulative learned pages at the end of each week from `from` to `today`. */
export function cumulativeLearned(
  records: readonly PageRecord[],
  from: LocalDate,
  today: LocalDate,
  startPages: number,
): DatedValue[] {
  const dates = records
    .filter((r) => r.learnedOn !== null && r.learnedOn >= from)
    .map((r) => r.learnedOn as LocalDate)
    .sort();
  const points: DatedValue[] = [{ date: from, value: startPages }];
  let i = 0;
  let total = startPages;
  for (let d = addDays(from, 7); ; d = addDays(d, 7)) {
    const end = d > today ? today : d;
    while (i < dates.length && (dates[i] ?? '') <= end) {
      i++;
      total++;
    }
    if (end > from) points.push({ date: end, value: total });
    if (end >= today) break;
  }
  return points;
}

/** The date from which tracking is meaningful: the later of plan start and set-up. */
export function trackingStartDate(planStart: LocalDate, setupDate: LocalDate | null): LocalDate {
  return setupDate ? maxDate(planStart, setupDate) : planStart;
}
