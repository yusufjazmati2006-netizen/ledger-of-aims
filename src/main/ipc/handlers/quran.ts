import type { EventName, EventPayloads } from '@shared/ipc/contract';
import type { RepoContext } from '../../db/repositories/context';
import { listPages, listReviews, setPageNote } from '../../db/repositories/quran';
import {
  learnNextPages,
  reviewPages,
  setPageStates,
  setupMushaf,
  undoMutation,
} from '../../services/quran';
import type { QuranMutation } from '@shared/schemas/quran';
import type { PartialHandlerTable } from '../types';

export type Emit = <E extends EventName>(event: E, payload: EventPayloads[E]) => void;

export function quranHandlers(ctx: RepoContext, emit: Emit): PartialHandlerTable {
  const celebrate = (result: QuranMutation) => {
    for (const milestone of result.completedMilestones) emit('milestone:completed', { milestone });
    return result;
  };
  return {
    'quran.pages': () => listPages(ctx),
    'quran.reviews': ({ from, to }) => listReviews(ctx, from, to),
    'quran.setup': (input) => celebrate(setupMushaf(ctx, input)),
    'quran.learnNext': ({ count }) => celebrate(learnNextPages(ctx, count)),
    'quran.setState': ({ pages, state }) => celebrate(setPageStates(ctx, pages, state)),
    'quran.review': ({ pages, rating }) => celebrate(reviewPages(ctx, pages, rating)),
    'quran.undo': ({ batchId, before }) => {
      undoMutation(ctx, batchId, before);
      return null;
    },
    'quran.setNote': ({ page, note }) => {
      setPageNote(ctx, page, note);
      return null;
    },
  };
}
