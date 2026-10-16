import { pageRangeLabel, pagesOfJuz } from '@shared/domain/quran/mushaf';
import { elapsedSeconds, formatElapsed } from '@shared/domain/game/time';
import { parseQuickLog, type ParseResult, type QuickCommand } from '@shared/domain/quicklog/parse';
import { durationLabel } from '@shared/domain/time/clockTime';
import { useSettings, useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { useNow } from '../../lib/useNow';
import { api } from '../../lib/api';
import { formatWeight } from '../../lib/units';
import { useQuran } from '../quran/useQuran';
import { useHabits } from '../review/useHabits';

export interface QuickPreview {
  label: string;
  /** Why the command cannot run right now, if it cannot. */
  blocked?: string;
}

export interface QuickOutcome {
  message: string;
  /** A screen to open instead of (or after) logging. */
  open?: string;
}

/**
 * Turns typed quick-log text into a preview ("Log 72.4 kg for today") and runs it
 * through the same channels the full screens use.
 */
export function useQuickLog(text: string): {
  parsed: ParseResult;
  preview: QuickPreview | null;
  run: () => Promise<QuickOutcome>;
} {
  const settings = useSettings();
  const today = useToday();
  const quran = useQuran();
  const habits = useHabits();
  const timer = useLedger('time.running', undefined, { domains: ['game'] });
  const now = useNow(30_000);
  const unit = settings.general.units;
  const parsed = parseQuickLog(text, unit);
  const command = parsed.status === 'command' ? parsed.command : null;

  const learnedIn = (pages: number[]) => {
    const learned = new Set(
      quran.records.filter((r) => r.state !== 'not_started').map((r) => r.page),
    );
    return pages.filter((p) => learned.has(p));
  };
  const reviewPages = (c: Extract<QuickCommand, { kind: 'review' }>): number[] => {
    const t = c.target;
    return 'juz' in t ? pagesOfJuz(quran.layout, t.juz) : rangeOf(t.from, t.to);
  };
  const habitFor = (query: string) =>
    habits.active.find((h) => h.name.toLowerCase().includes(query));

  const preview = ((): QuickPreview | null => {
    if (!command) return null;
    switch (command.kind) {
      case 'weight':
        return { label: `Log ${formatWeight(command.kg, unit)} as today’s weight` };
      case 'learn': {
        if (!quran.setUp) return { label: 'Learn new pages', blocked: 'Set up the mushaf first.' };
        const next = quran.nextPages.slice(0, command.count);
        return {
          label: `Learn the next ${command.count} page${command.count === 1 ? '' : 's'}${next.length === command.count ? ` (${pageRangeLabel(next)})` : ''}`,
          blocked: next.length === 0 ? 'Every page is already learned.' : undefined,
        };
      }
      case 'learn-range': {
        if (!quran.setUp) return { label: 'Learn pages', blocked: 'Set up the mushaf first.' };
        const pages = rangeOf(command.from, command.to);
        const fresh = pages.filter((p) => !learnedIn([p]).length);
        return {
          label: `Learn ${pageRangeLabel(pages)}`,
          blocked: fresh.length === 0 ? 'Those pages are already learned.' : undefined,
        };
      }
      case 'review': {
        const pages = reviewPages(command);
        const learned = learnedIn(pages);
        const what = 'juz' in command.target ? `juz ${command.target.juz}` : pageRangeLabel(pages);
        return {
          label: `Rate ${what} as ${command.rating}${learned.length !== pages.length && learned.length > 0 ? ` (${learned.length} learned pages)` : ''}`,
          blocked: learned.length === 0 ? 'None of those pages are learned yet.' : undefined,
        };
      }
      case 'study':
        return {
          label: `Log ${durationLabel(command.minutes)} of study${command.note ? ` — ${command.note}` : ''}`,
        };
      case 'game-time':
        return {
          label: `Log ${durationLabel(command.minutes)} on the game${command.note ? ` — ${command.note}` : ''}`,
        };
      case 'timer-start':
        return {
          label: `Start the game timer${command.note ? ` — ${command.note}` : ''}`,
          blocked: timer.data ? 'A timer is already running.' : undefined,
        };
      case 'timer-stop':
        return timer.data
          ? {
              label: `Stop the game timer (${formatElapsed(elapsedSeconds(timer.data.startedAt, now))})`,
            }
          : { label: 'Stop the game timer', blocked: 'No timer is running.' };
      case 'workout':
        return { label: 'Open today’s workout' };
      case 'habit': {
        const habit = habitFor(command.query);
        if (!habit)
          return { label: 'Tick a habit', blocked: `No habit matches “${command.query}”.` };
        return {
          label: `Tick “${habit.name}” for today`,
          blocked: habit.checks.has(today) ? 'Already ticked today.' : undefined,
        };
      }
    }
  })();

  const run = async (): Promise<QuickOutcome> => {
    if (!command || !preview || preview.blocked)
      throw new Error(preview?.blocked ?? 'Nothing to log.');
    switch (command.kind) {
      case 'weight':
        await api('weighIns.upsert', { date: today, weightKg: command.kg, note: '' });
        return { message: `Logged ${formatWeight(command.kg, unit)}.` };
      case 'learn': {
        const r = await api('quran.learnNext', { count: command.count });
        return { message: `Learned ${pageRangeLabel(r.after.map((p) => p.page))}.` };
      }
      case 'learn-range': {
        const pages = rangeOf(command.from, command.to).filter((p) => !learnedIn([p]).length);
        await api('quran.setState', { pages, state: 'new' });
        return { message: `Learned ${pageRangeLabel(pages)}.` };
      }
      case 'review': {
        const pages = learnedIn(reviewPages(command));
        await api('quran.review', { pages, rating: command.rating });
        return {
          message: `Rated ${pages.length} page${pages.length === 1 ? '' : 's'} ${command.rating}.`,
        };
      }
      case 'study':
        await api('study.log', {
          date: today,
          minutes: command.minutes,
          moduleId: null,
          note: command.note,
        });
        return { message: `Logged ${durationLabel(command.minutes)} of study.` };
      case 'game-time':
        await api('time.addManual', {
          date: today,
          start: null,
          minutes: command.minutes,
          focus: false,
          note: command.note,
        });
        return { message: `Logged ${durationLabel(command.minutes)} on the game.` };
      case 'timer-start':
        await api('time.start', { note: command.note });
        return { message: 'Game timer started.' };
      case 'timer-stop': {
        const entry = await api('time.stop', { note: '', focus: false });
        const minutes =
          (new Date(entry.endedAt ?? entry.startedAt).getTime() -
            new Date(entry.startedAt).getTime()) /
          60_000;
        return { message: `Logged ${durationLabel(minutes)} on the game.` };
      }
      case 'workout':
        return { message: 'Opening today’s workout.', open: '/physique/training' };
      case 'habit': {
        const habit = habitFor(command.query);
        if (!habit) throw new Error('No matching habit.');
        await api('habits.check', { habitId: habit.id, date: today, done: true });
        return { message: `Ticked “${habit.name}”.` };
      }
    }
  };

  return { parsed, preview, run };
}

function rangeOf(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
