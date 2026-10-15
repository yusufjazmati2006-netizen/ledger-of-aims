import { create } from 'zustand';
import type { Milestone } from '@shared/schemas/core';

interface CelebrationState {
  queue: Milestone[];
  celebrate: (milestone: Milestone) => void;
  dismiss: () => void;
}

/** Milestones waiting to be acknowledged, shown one at a time. */
export const useCelebration = create<CelebrationState>((set, get) => ({
  queue: [],
  celebrate: (milestone) => {
    if (get().queue.some((m) => m.id === milestone.id)) return;
    set({ queue: [...get().queue, milestone] });
  },
  dismiss: () => {
    set({ queue: get().queue.slice(1) });
  },
}));
