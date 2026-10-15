/**
 * Parses a typed duration into whole minutes. Accepted forms:
 *
 *   45, 45m, 45 min, 45mins   → minutes (a bare number is always minutes)
 *   1.5h, 1,5h, 2 hours        → hours
 *   1h30, 1h 30m, 1 h 30 min   → hours and minutes
 *   1:30                       → hours:minutes
 *
 * Returns null for anything else, or for durations under a minute or over 24 hours.
 */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase().replace(',', '.');
  if (!t) return null;
  let minutes: number | null = null;

  const colon = /^(\d{1,2}):([0-5]\d)$/.exec(t);
  const hm = /^(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\s*(?:(\d{1,2})\s*(?:m(?:in(?:ute)?s?)?)?)?$/.exec(
    t,
  );
  const m = /^(\d+(?:\.\d+)?)\s*(?:m(?:in(?:ute)?s?)?)?$/.exec(t);
  if (colon) minutes = Number(colon[1]) * 60 + Number(colon[2]);
  else if (hm) minutes = Number(hm[1]) * 60 + (hm[2] ? Number(hm[2]) : 0);
  else if (m) minutes = Number(m[1]);

  if (minutes === null || !Number.isFinite(minutes)) return null;
  const rounded = Math.round(minutes);
  return rounded >= 1 && rounded <= 24 * 60 ? rounded : null;
}
