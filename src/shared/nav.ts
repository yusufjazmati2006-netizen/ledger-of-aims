/**
 * Primary navigation. Shared by the sidebar, the application menu (with ⌘1–⌘9
 * accelerators) and the command palette so they never disagree.
 */
export interface NavItem {
  path: string;
  label: string;
  goal?: 'quran' | 'game' | 'degree' | 'physique';
}

/** Goals appear in the order of their letters (A Quran, B Game, C Degree, D Physique). */
export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: 'Today' },
  { path: '/quran', label: 'Quran', goal: 'quran' },
  { path: '/game', label: 'Game', goal: 'game' },
  { path: '/degree', label: 'Degree', goal: 'degree' },
  { path: '/physique', label: 'Physique', goal: 'physique' },
  { path: '/planner', label: 'Planner' },
  { path: '/review', label: 'Weekly review' },
  { path: '/milestones', label: 'Milestones' },
  { path: '/search', label: 'Search' },
];

export const SETTINGS_PATH = '/settings';
