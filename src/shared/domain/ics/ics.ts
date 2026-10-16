/**
 * A small RFC 5545 (iCalendar) writer for exporting milestones, deadlines, plan blocks
 * and shifts to Apple Calendar or any other calendar app.
 *
 * - All-day events use DATE values with an exclusive DTEND (the next day).
 * - Timed events use floating local times (no time zone), which calendar apps show at
 *   the same wall-clock time — right for shifts and plans made in local time.
 * - Text is escaped (backslash, semicolon, comma, newline), lines end in CRLF, and long
 *   lines are folded at 75 octets without splitting a UTF-8 character.
 */
import { addDays, type LocalDate } from '../time/localDate';

export type IcsEvent =
  | {
      uid: string;
      summary: string;
      description?: string;
      categories?: string[];
      date: LocalDate;
    }
  | {
      uid: string;
      summary: string;
      description?: string;
      categories?: string[];
      /** Local date and minutes after midnight; `end` may exceed 1440 (next day). */
      startDate: LocalDate;
      start: number;
      end: number;
    };

export function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

const encoder = new TextEncoder();

/** Folds a content line to at most 75 octets per line (continuations start with a space). */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  let limit = 75;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
      limit = 74; // the leading space of a continuation line counts
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const compactDate = (d: LocalDate) => d.replace(/-/g, '');

function localDateTime(date: LocalDate, minute: number): string {
  const day = addDays(date, Math.floor(minute / 1440));
  const m = ((minute % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${compactDate(day)}T${hh}${mm}00`;
}

function utcStamp(instant: Date): string {
  return instant
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export function buildCalendar(
  events: readonly IcsEvent[],
  options: { name: string; now: Date },
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ledger of Aims//Ledger of Aims//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(options.name)}`,
  ];
  const stamp = utcStamp(options.now);
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp}`);
    if ('date' in e) {
      lines.push(
        `DTSTART;VALUE=DATE:${compactDate(e.date)}`,
        `DTEND;VALUE=DATE:${compactDate(addDays(e.date, 1))}`,
        'TRANSP:TRANSPARENT',
      );
    } else {
      lines.push(
        `DTSTART:${localDateTime(e.startDate, e.start)}`,
        `DTEND:${localDateTime(e.startDate, e.end)}`,
      );
    }
    lines.push(`SUMMARY:${escapeText(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.categories?.length) lines.push(`CATEGORIES:${e.categories.map(escapeText).join(',')}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
