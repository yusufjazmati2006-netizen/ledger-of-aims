/**
 * Today's actions, ranked and packed into the minutes actually available.
 *
 * Each candidate carries a score (0–100) built from urgency (deadlines, overdue
 * training, due revision), how far behind its goal is, and whether a streak is at
 * risk. Candidates are packed greedily by score: one that does not fit whole is
 * shortened down to its minimum if that fits, otherwise it waits under "if you have
 * more time". Quick actions (a one-minute weigh-in) are taken first, so they always
 * fit.
 */
import type { GoalId } from '../../schemas/common';
import type { Urgency } from '../degree/deadlines';
import type { TrainingStatus } from '../physique/schedule';
import type { Verdict } from '../quran/pace';

export interface Candidate {
  id: string;
  /** Null for actions that belong to no single goal (e.g. a general habit). */
  goalId: GoalId | null;
  title: string;
  /** Why this is suggested, in a few words. */
  reason: string;
  minutes: number;
  minMinutes: number;
  score: number;
  link: string;
}

export interface TodayInputs {
  quran: {
    dueCount: number;
    minutesPerPage: number;
    revisionMinutes: number;
    newMinutes: number;
    verdict: Verdict | null;
    deficitPages: number;
    revisedToday: boolean;
    learnedToday: boolean;
    revisionStreakAtRisk: boolean;
  } | null;
  training: { status: TrainingStatus; minutes: number } | null;
  weighedToday: boolean;
  deadline: { title: string; urgency: Urgency; label: string } | null;
  study: { behindMinutes: number; sessionMinutes: number };
  game: { task: string | null; behindMinutes: number; sessionMinutes: number };
  habitsAtRisk: readonly { id: string; name: string; goalId: GoalId | null }[];
}

const URGENCY_SCORE: Record<Urgency, number> = {
  overdue: 95,
  imminent: 90,
  near: 72,
  soon: 52,
  calm: 30,
};

export function candidates(i: TodayInputs): Candidate[] {
  const out: Candidate[] = [];
  const q = i.quran;
  if (q && q.dueCount > 0 && !q.revisedToday) {
    const minutes = Math.max(
      5,
      Math.min(q.revisionMinutes, Math.ceil(q.dueCount * q.minutesPerPage)),
    );
    out.push({
      id: 'quran-revision',
      goalId: 'quran',
      title: `Revise ${q.dueCount} page${q.dueCount === 1 ? '' : 's'}`,
      reason: q.revisionStreakAtRisk ? 'Due today · streak at risk' : 'Due today',
      minutes,
      minMinutes: Math.min(minutes, 10),
      score: 82 + (q.revisionStreakAtRisk ? 8 : 0),
      link: '/quran/revision',
    });
  }
  if (q && q.newMinutes > 0 && !q.learnedToday) {
    const behind = q.verdict === 'behind';
    out.push({
      id: 'quran-new',
      goalId: 'quran',
      title: 'Learn new pages',
      reason: behind ? `${Math.abs(q.deficitPages)} pages behind the plan` : 'Keeps the pace',
      minutes: q.newMinutes,
      minMinutes: Math.min(q.newMinutes, 10),
      score: behind ? 78 : q.verdict === 'ahead' ? 45 : 58,
      link: '/quran',
    });
  }
  if (!i.weighedToday) {
    out.push({
      id: 'weigh-in',
      goalId: 'physique',
      title: 'Weigh in',
      reason: 'One minute; keeps the trend honest',
      minutes: 1,
      minMinutes: 1,
      score: 70,
      link: '/physique',
    });
  }
  if (i.training) {
    const s = i.training.status;
    if (s.kind === 'due' || s.kind === 'overdue') {
      out.push({
        id: 'training',
        goalId: 'physique',
        title: 'Full-body training session',
        reason:
          s.kind === 'overdue'
            ? `${s.daysLate} day${s.daysLate === 1 ? '' : 's'} late`
            : 'Training day',
        minutes: i.training.minutes,
        minMinutes: Math.min(45, i.training.minutes),
        score: s.kind === 'overdue' ? 80 : 68,
        link: '/physique/training',
      });
    }
  }
  if (i.deadline && i.deadline.urgency !== 'calm') {
    out.push({
      id: 'deadline',
      goalId: 'degree',
      title: `Work on ${i.deadline.title}`,
      reason: i.deadline.label,
      minutes: i.study.sessionMinutes,
      minMinutes: 25,
      score: URGENCY_SCORE[i.deadline.urgency],
      link: '/degree',
    });
  } else if (i.study.behindMinutes > 0) {
    out.push({
      id: 'study',
      goalId: 'degree',
      title: 'Study session',
      reason: `${Math.round(i.study.behindMinutes / 6) / 10} h left of this week’s target`,
      minutes: Math.min(i.study.sessionMinutes, i.study.behindMinutes),
      minMinutes: 25,
      score: 40 + Math.min(25, i.study.behindMinutes / 12),
      link: '/degree/study',
    });
  }
  if (i.game.behindMinutes > 0 || i.game.task) {
    out.push({
      id: 'game',
      goalId: 'game',
      title: i.game.task ?? 'Game development',
      reason:
        i.game.behindMinutes > 0
          ? `${Math.round(i.game.behindMinutes / 6) / 10} h left of this week’s target`
          : 'Weekly hours met — a bonus session',
      minutes: i.game.sessionMinutes,
      minMinutes: 25,
      score: 38 + Math.min(25, i.game.behindMinutes / 12),
      link: '/game',
    });
  }
  for (const habit of i.habitsAtRisk) {
    out.push({
      id: `habit-${habit.id}`,
      goalId: habit.goalId,
      title: habit.name,
      reason: 'Habit streak at risk',
      minutes: 5,
      minMinutes: 5,
      score: 64,
      link: '/review/habits',
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

export interface Packed {
  now: Candidate[];
  later: Candidate[];
  usedMinutes: number;
}

/** Actions this short are taken first: they cost almost nothing and are easy to skip. */
const QUICK_MINUTES = 2;

export function pack(list: readonly Candidate[], available: number): Packed {
  const sorted = [...list].sort((a, b) => b.score - a.score);
  let left = Math.max(0, available);
  const chosen = new Map<string, Candidate>();
  for (const c of sorted) {
    if (c.minutes <= QUICK_MINUTES && c.minutes <= left) {
      chosen.set(c.id, c);
      left -= c.minutes;
    }
  }
  for (const c of sorted) {
    if (chosen.has(c.id)) continue;
    if (c.minutes <= left) {
      chosen.set(c.id, c);
      left -= c.minutes;
    } else if (c.minMinutes <= left && left > 0) {
      chosen.set(c.id, { ...c, minutes: left });
      left = 0;
    }
  }
  return {
    now: sorted.filter((c) => chosen.has(c.id)).map((c) => chosen.get(c.id) as Candidate),
    later: sorted.filter((c) => !chosen.has(c.id)),
    usedMinutes: Math.max(0, available) - left,
  };
}
