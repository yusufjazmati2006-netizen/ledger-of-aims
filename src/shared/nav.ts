/**
 * Primary navigation. Shared by the sidebar, the application menu (with ⌘1–⌘9
 * accelerators) and the command palette so they never disagree.
 */
export interface NavItem {
  path: string;
  label: string;
  goal?: 'quran' | 'game' | 'degree' | 'physique';
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: 'Today' },
  { path: '/quran', label: 'Quran', goal: 'quran' },
  { path: '/milestones', label: 'Milestones' },
];

export const SETTINGS_PATH = '/settings';
