import type { GoalId } from '@shared/schemas/common';
import type { IconName } from '../design/icons';

export const GOAL_META: Record<GoalId, { icon: IconName; short: string; path: string }> = {
  quran: { icon: 'book', short: 'Quran', path: '/quran' },
  physique: { icon: 'dumbbell', short: 'Physique', path: '/physique' },
  degree: { icon: 'cap', short: 'Degree', path: '/degree' },
  game: { icon: 'gamepad', short: 'Game', path: '/game' },
};
