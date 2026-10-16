import { buildCalendar, type IcsEvent } from '@shared/domain/ics/ics';
import { spanOf } from '@shared/domain/time/clockTime';
import { addDays } from '@shared/domain/time/localDate';
import type { RepoContext } from '../db/repositories/context';
import { listShiftDays, listShiftTypes } from '../db/repositories/shifts';
import { listPlanBlocks } from '../db/repositories/plan';

const GOAL_LABEL: Record<string, string> = {
  quran: 'Quran',
  game: 'Game',
  degree: 'Degree',
  physique: 'Physique',
};
const uid = (kind: string, id: string) => `${kind}-${id}@ledgerofaims.local`;

/**
 * An .ics calendar of milestones, assessment deadlines, and — for the next eight weeks
 * — planned blocks and shifts. Stable UIDs mean re-importing updates events rather
 * than duplicating them.
 */
export function calendarExport(
  ctx: RepoContext,
  options: { milestones: boolean; deadlines: boolean; plan: boolean; shifts: boolean },
): { text: string; events: number } {
  const events: IcsEvent[] = [];
  const today = ctx.clock.today();
  const until = addDays(today, 8 * 7);

  if (options.milestones) {
    for (const m of ctx.db
      .prepare<
        [],
        {
          id: string;
          goal_id: string;
          title: string;
          target_date: string;
          notes: string;
          completed_at: string | null;
        }
      >(
        'SELECT id, goal_id, title, target_date, notes, completed_at FROM milestones ORDER BY target_date',
      )
      .all()) {
      const goal = GOAL_LABEL[m.goal_id] ?? m.goal_id;
      events.push({
        uid: uid('milestone', m.id),
        date: m.target_date,
        summary: `${goal}: ${m.title}${m.completed_at ? ' ✓' : ''}`,
        description: m.notes || undefined,
        categories: [goal, 'Milestone'],
      });
    }
  }
  if (options.deadlines) {
    for (const a of ctx.db
      .prepare<
        [],
        {
          id: string;
          title: string;
          due_date: string;
          code: string;
          module: string;
          status: string;
        }
      >(
        `SELECT a.id, a.title, a.due_date, m.code, m.title AS module, a.status
         FROM assessments a JOIN modules m ON m.id = a.module_id WHERE a.due_date IS NOT NULL`,
      )
      .all()) {
      events.push({
        uid: uid('assessment', a.id),
        date: a.due_date,
        summary: `Due: ${a.title} (${a.code || a.module})`,
        description: `Status: ${a.status.replace('-', ' ')}`,
        categories: ['Degree', 'Deadline'],
      });
    }
  }
  if (options.plan) {
    for (const b of listPlanBlocks(ctx, today, until)) {
      events.push({
        uid: uid('block', b.id),
        startDate: b.date,
        start: b.start,
        end: b.end,
        summary: b.title || GOAL_LABEL[b.goalId] || 'Planned block',
        categories: [GOAL_LABEL[b.goalId] ?? b.goalId, 'Plan'],
      });
    }
  }
  if (options.shifts) {
    const types = new Map(listShiftTypes(ctx).map((t) => [t.id, t]));
    for (const d of listShiftDays(ctx, today, until)) {
      const t = d.shiftTypeId ? types.get(d.shiftTypeId) : undefined;
      if (!t?.start || !t.end) continue;
      const span = spanOf(t.start, t.end);
      events.push({
        uid: uid('shift', d.date),
        startDate: d.date,
        start: span.start,
        end: span.end,
        summary: `${t.label} shift`,
        categories: ['Shift'],
      });
    }
  }
  return {
    text: buildCalendar(events, { name: 'Ledger of Aims', now: ctx.clock.now() }),
    events: events.length,
  };
}
