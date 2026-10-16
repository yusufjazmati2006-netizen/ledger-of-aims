/**
 * The quick-log grammar shared by the ⌘K palette and the global quick-log window.
 * The first word picks the command; everything is case-insensitive.
 *
 *   w 72.4          today's weight (in your display unit; or say "72.4kg" / "160lb")
 *   p 3             learn the next 3 pages in your memorisation order
 *   p 322-324       learn those pages
 *   r 1-20 solid    rate pages as solid / shaky / forgotten
 *   r j17 shaky     rate a whole juz
 *   s 1.5h essay    log study time (with an optional note)
 *   g 45m tilemap   log game time; "g start [note]" and "g stop" run the timer
 *   wo              open today's workout
 *   h phone         tick the habit whose name contains "phone"
 *
 * Durations: 45m, 1.5h, 1h30, 1:30 — and, because these are quick logs, a bare number
 * under 10 is hours ("s 2" is two hours) while a larger one is minutes ("g 45").
 */
import { parseDuration } from '../time/duration';
import type { Rating } from '../quran/scheduler';

export type QuickCommand =
  | { kind: 'weight'; kg: number }
  | { kind: 'learn'; count: number }
  | { kind: 'learn-range'; from: number; to: number }
  | { kind: 'review'; target: { from: number; to: number } | { juz: number }; rating: Rating }
  | { kind: 'study'; minutes: number; note: string }
  | { kind: 'game-time'; minutes: number; note: string }
  | { kind: 'timer-start'; note: string }
  | { kind: 'timer-stop' }
  | { kind: 'workout' }
  | { kind: 'habit'; query: string };

export type ParseResult =
  | { status: 'command'; command: QuickCommand }
  /** A command word was recognised but the rest is missing or wrong. */
  | { status: 'incomplete'; hint: string }
  /** Not a quick-log command: treat the text as a search. */
  | { status: 'none' };

export const GRAMMAR_HELP: readonly { example: string; description: string }[] = [
  { example: 'w 72.4', description: 'Today’s weight' },
  { example: 'p 3', description: 'Learn the next 3 pages' },
  { example: 'r 1-20 solid', description: 'Rate pages (solid, shaky, forgotten)' },
  { example: 'r j17 shaky', description: 'Rate a whole juz' },
  { example: 's 1.5h', description: 'Log study time' },
  { example: 'g 45m', description: 'Log game time' },
  { example: 'g start', description: 'Start the game timer (g stop to stop)' },
  { example: 'wo', description: 'Open today’s workout' },
  { example: 'h phone', description: 'Tick a habit' },
];

const RATINGS: Record<string, Rating> = {
  solid: 'solid',
  good: 'solid',
  ok: 'solid',
  shaky: 'shaky',
  weak: 'shaky',
  forgot: 'forgotten',
  forgotten: 'forgotten',
  lost: 'forgotten',
};

const LB_PER_KG = 2.20462;

export function quickDuration(text: string): number | null {
  const t = text.trim();
  if (/^\d+(?:[.,]\d+)?$/.test(t)) {
    const n = Number(t.replace(',', '.'));
    if (n < 10) return parseDuration(`${t}h`);
  }
  return parseDuration(t);
}

/** Splits "1.5h essay plan" into a duration and the rest, trying the longest prefix. */
function durationAndNote(words: string[]): { minutes: number; note: string } | null {
  for (let take = Math.min(4, words.length); take >= 1; take--) {
    const minutes = quickDuration(words.slice(0, take).join(' '));
    if (minutes !== null) return { minutes, note: words.slice(take).join(' ') };
  }
  return null;
}

function pageRange(text: string): { from: number; to: number } | null {
  const m = /^(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/.exec(text);
  if (!m) return null;
  const from = Number(m[1]);
  const to = m[2] ? Number(m[2]) : from;
  if (from < 1 || to > 604 || to < from) return null;
  return { from, to };
}

export function parseQuickLog(input: string, displayUnit: 'kg' | 'lb' = 'kg'): ParseResult {
  const text = input.trim().replace(/\s+/g, ' ');
  if (!text) return { status: 'none' };
  const [head = '', ...rest] = text.split(' ');
  const word = head.toLowerCase();
  const args = rest.join(' ');

  switch (word) {
    case 'w': {
      const m = /^(\d{2,3}(?:[.,]\d{1,2})?)\s*(kg|lb|lbs)?$/i.exec(args);
      if (!m) return { status: 'incomplete', hint: `w 72.4 — today’s weight in ${displayUnit}` };
      const value = Number((m[1] ?? '').replace(',', '.'));
      const unit = m[2]?.toLowerCase().startsWith('lb') ? 'lb' : m[2] ? 'kg' : displayUnit;
      const kg = Math.round((unit === 'lb' ? value / LB_PER_KG : value) * 100) / 100;
      if (kg < 25 || kg > 350)
        return { status: 'incomplete', hint: 'That weight looks out of range.' };
      return { status: 'command', command: { kind: 'weight', kg } };
    }
    case 'p': {
      if (/^\d+$/.test(args)) {
        const count = Number(args);
        if (count >= 1 && count <= 40)
          return { status: 'command', command: { kind: 'learn', count } };
        return {
          status: 'incomplete',
          hint: 'p 3 learns the next 3 pages (up to 40); for specific pages use a range, e.g. p 322-324',
        };
      }
      const range = pageRange(args);
      if (range && /[-–]/.test(args))
        return { status: 'command', command: { kind: 'learn-range', ...range } };
      return {
        status: 'incomplete',
        hint: 'p 3 — learn the next 3 pages · p 322-324 — those pages',
      };
    }
    case 'r': {
      const m = /^(?:(?:j|juz)\s*(\d{1,2})|(\d{1,3}(?:\s*[-–]\s*\d{1,3})?))\s+([a-z]+)$/i.exec(
        args,
      );
      const rating = m ? RATINGS[(m[3] ?? '').toLowerCase()] : undefined;
      if (!m || !rating)
        return {
          status: 'incomplete',
          hint: 'r 1-20 solid · r j17 shaky — solid, shaky or forgotten',
        };
      if (m[1]) {
        const juz = Number(m[1]);
        if (juz < 1 || juz > 30) return { status: 'incomplete', hint: 'A juz is 1 to 30.' };
        return { status: 'command', command: { kind: 'review', target: { juz }, rating } };
      }
      const range = pageRange(m[2] ?? '');
      if (!range)
        return { status: 'incomplete', hint: 'Pages run from 1 to 604, e.g. r 1-20 solid' };
      return { status: 'command', command: { kind: 'review', target: range, rating } };
    }
    case 's': {
      const parsed = durationAndNote(rest);
      if (!parsed) return { status: 'incomplete', hint: 's 1.5h — log study time (45m, 1:30…)' };
      return { status: 'command', command: { kind: 'study', ...parsed } };
    }
    case 'g': {
      const sub = rest[0]?.toLowerCase();
      if (sub === 'start')
        return {
          status: 'command',
          command: { kind: 'timer-start', note: rest.slice(1).join(' ') },
        };
      if (sub === 'stop') return { status: 'command', command: { kind: 'timer-stop' } };
      const parsed = durationAndNote(rest);
      if (!parsed)
        return {
          status: 'incomplete',
          hint: 'g 45m — log game time · g start / g stop — the timer',
        };
      return { status: 'command', command: { kind: 'game-time', ...parsed } };
    }
    case 'wo':
      return args ? { status: 'none' } : { status: 'command', command: { kind: 'workout' } };
    case 'h': {
      if (!args)
        return { status: 'incomplete', hint: 'h phone — tick the habit containing “phone”' };
      return { status: 'command', command: { kind: 'habit', query: args.toLowerCase() } };
    }
    default:
      return { status: 'none' };
  }
}
