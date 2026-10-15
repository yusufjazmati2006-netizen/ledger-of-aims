import { useState } from 'react';
import type { Goal } from '@shared/schemas/core';
import { api } from '../../lib/api';
import { toast } from '../../stores/toasts';
import { Icon } from '../../design/icons';

/**
 * The game's "next single action": always visible here and on the Today screen.
 * One concrete physical step is the antidote to a goal this large.
 */
export function NextActionBanner({ goal }: { goal: Goal }) {
  const [draft, setDraft] = useState<string | null>(null);
  const save = async () => {
    if (draft === null) return;
    const value = draft.trim();
    setDraft(null);
    if (value === goal.nextAction) return;
    await api('goals.update', { id: goal.id, patch: { nextAction: value } }).catch(() => {
      toast.error('Could not save the next action.');
    });
  };
  return (
    <div className="-mt-3 mb-7 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3">
      <Icon name="arrowRight" className="shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <div className="eyebrow !text-accent">Next single action</div>
        {draft !== null ? (
          <input
            autoFocus
            aria-label="Next single action for the game"
            className="mt-0.5 w-full bg-transparent text-[14.5px] font-medium text-ink outline-none"
            value={draft}
            maxLength={280}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void save()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
              if (e.key === 'Escape') setDraft(null);
            }}
          />
        ) : (
          <button
            type="button"
            className="mt-0.5 block w-full text-left text-[14.5px] font-medium text-ink"
            onClick={() => setDraft(goal.nextAction)}
            aria-label="Edit the next single action for the game"
          >
            {goal.nextAction || (
              <span className="font-normal text-ink-faint">What is the one next step?</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
