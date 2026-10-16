import { describe, expect, it } from 'vitest';
import { buildCalendar, escapeText, foldLine } from './ics';

const now = new Date('2026-10-15T08:00:00Z');
const bytes = (s: string) => new TextEncoder().encode(s).length;

describe('iCalendar export', () => {
  it('escapes text as RFC 5545 requires', () => {
    expect(escapeText('Essay; part 1, draft\\final\nsecond line')).toBe(
      'Essay\\; part 1\\, draft\\\\final\\nsecond line',
    );
  });

  it('folds long lines at 75 octets without splitting characters', () => {
    const line = `SUMMARY:${'Muraja’ah — juz 17 · '.repeat(8)}`;
    const folded = foldLine(line);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(bytes(p)).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every((p) => p.startsWith(' '))).toBe(true);
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join('')).toBe(line);
    expect(foldLine('SHORT:line')).toBe('SHORT:line');
  });

  it('writes all-day and timed events, including a night shift past midnight', () => {
    const ics = buildCalendar(
      [
        {
          uid: 'milestone-1@ledgerofaims.local',
          summary: 'Quran: 20 juz memorised',
          categories: ['Quran'],
          date: '2027-03-04',
        },
        {
          uid: 'shift-2026-10-15@ledgerofaims.local',
          summary: 'Night shift',
          startDate: '2026-10-15',
          start: 960,
          end: 1500,
        },
      ],
      { name: 'Ledger of Aims', now },
    );
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTAMP:20261015T080000Z');
    expect(ics).toContain('DTSTART;VALUE=DATE:20270304\r\nDTEND;VALUE=DATE:20270305');
    expect(ics).toContain('DTSTART:20261015T160000\r\nDTEND:20261016T010000');
    expect(ics).toContain('CATEGORIES:Quran');
    expect(ics.split('BEGIN:VEVENT')).toHaveLength(3);
    // Every line ends in CRLF; no bare LF anywhere.
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });
});
