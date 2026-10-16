import type { IconName } from '../../design/icons';

export interface PaletteEntry {
  id: string;
  label: string;
  group: 'Go to' | 'Log';
  icon: IconName;
  keywords?: string;
  /** Navigate here when chosen. */
  path?: string;
  /** Or put this text in the input, to finish typing a quick log. */
  insert?: string;
}

const go = (label: string, path: string, icon: IconName, keywords = ''): PaletteEntry => ({
  id: `go:${path}`,
  label,
  group: 'Go to',
  icon,
  path,
  keywords,
});
const log = (label: string, insert: string, icon: IconName, keywords = ''): PaletteEntry => ({
  id: `log:${insert}`,
  label,
  group: 'Log',
  icon,
  insert,
  keywords,
});

export const PALETTE_ENTRIES: readonly PaletteEntry[] = [
  go('Today', '/', 'today', 'home focus'),
  go('Quran', '/quran', 'book', 'hifz pace'),
  go('Quran · Revision', '/quran/revision', 'book', 'murajaah review queue'),
  go('Quran · Mushaf', '/quran/mushaf', 'book', 'pages grid juz'),
  go('Quran · Learning log', '/quran/log', 'book', 'new pages history'),
  go('Game · Roadmap', '/game', 'gamepad', 'tasks phases'),
  go('Game · Learning path', '/game/learning', 'gamepad', 'engine tutorials'),
  go('Game · Practice projects', '/game/practice', 'gamepad', 'clones'),
  go('Game · Time', '/game/time', 'gamepad', 'timer hours'),
  go('Game · Devlog', '/game/devlog', 'gamepad', 'journal notes'),
  go('Game · Steam readiness', '/game/steam', 'gamepad', 'checklist release'),
  go('Degree', '/degree', 'cap', 'overview classification what do i need'),
  go('Degree · Modules', '/degree/modules', 'cap', 'assessments grades'),
  go('Degree · Calendar', '/degree/calendar', 'cap', 'deadlines'),
  go('Degree · Study', '/degree/study', 'cap', 'sessions hours'),
  go('Physique · Weight', '/physique', 'dumbbell', 'trend weigh-in'),
  go('Physique · Training', '/physique/training', 'dumbbell', 'workout sets gym'),
  go('Physique · Nutrition', '/physique/nutrition', 'dumbbell', 'calories protein food'),
  go('Physique · Meal prep', '/physique/meal-prep', 'dumbbell', 'shopping list'),
  go('Physique · Photos', '/physique/photos', 'dumbbell', 'progress compare'),
  go('Planner', '/planner', 'calendar', 'week shifts plan schedule'),
  go('Weekly review', '/review', 'review', 'reflection priorities'),
  go('Review history', '/review/history', 'review', 'past weeks'),
  go('Habits', '/review/habits', 'check', 'streaks'),
  go('Milestones', '/milestones', 'flag', 'targets'),
  go('Settings', '/settings', 'settings', 'preferences notifications shortcut'),
  log('Log weight', 'w ', 'dumbbell', 'weigh in'),
  log('Learn new pages', 'p ', 'book', 'quran memorise'),
  log('Rate revised pages', 'r ', 'book', 'quran review solid shaky forgotten'),
  log('Log study time', 's ', 'cap', 'degree'),
  log('Log game time', 'g ', 'gamepad', 'hours'),
  log('Start the game timer', 'g start', 'play', 'timer'),
  log('Stop the game timer', 'g stop', 'stop', 'timer'),
  log('Tick a habit', 'h ', 'check', 'habit'),
];

/** Every word typed must start a word of the label or keywords (in any order). */
export function searchEntries(
  query: string,
  entries: readonly PaletteEntry[] = PALETTE_ENTRIES,
): PaletteEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const scored = entries
    .map((e) => {
      const label = e.label.toLowerCase();
      const hay = `${label} ${e.keywords ?? ''}`.split(/[\s·]+/).filter(Boolean);
      let score = 0;
      for (const w of words) {
        if (hay.some((h) => h.startsWith(w)))
          score += label.split(/[\s·]+/).some((h) => h.startsWith(w)) ? 3 : 1;
        else if (label.includes(w)) score += 1;
        else return null;
      }
      if (label.startsWith(words[0] ?? '')) score += 2;
      return { e, score };
    })
    .filter((x): x is { e: PaletteEntry; score: number } => x !== null);
  return scored.sort((a, b) => b.score - a.score).map((x) => x.e);
}
