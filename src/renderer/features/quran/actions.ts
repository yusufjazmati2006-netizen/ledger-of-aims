import { pageRangeLabel } from '@shared/domain/quran/mushaf';
import type { PageState, Rating } from '@shared/domain/quran/scheduler';
import type { QuranMutation } from '@shared/schemas/quran';
import { api, ApiError } from '../../lib/api';
import { toast } from '../../stores/toasts';

const STATE_LABEL: Record<PageState, string> = {
  not_started: 'not started',
  new: 'learned today',
  memorized: 'memorised',
  revision: 'needing revision',
};

export const RATING_LABEL: Record<Rating, string> = {
  solid: 'Solid',
  shaky: 'Shaky',
  forgotten: 'Forgotten',
};

function offerUndo(result: QuranMutation, message: string) {
  if (result.before.length === 0) {
    toast.info('Nothing to change.');
    return;
  }
  toast.success(message, {
    label: 'Undo',
    run: () => {
      void api('quran.undo', { batchId: result.batchId, before: result.before }).catch(() =>
        toast.error('Could not undo.'),
      );
    },
  });
}

function fail(error: unknown) {
  toast.error(error instanceof ApiError ? error.message : 'Something went wrong.');
}

export async function ratePages(pages: number[], rating: Rating): Promise<void> {
  try {
    const result = await api('quran.review', { pages, rating });
    offerUndo(
      result,
      `${pageRangeLabel(result.before.map((r) => r.page))} rated ${RATING_LABEL[rating].toLowerCase()}.`,
    );
  } catch (error) {
    fail(error);
  }
}

export async function setPagesState(pages: number[], state: PageState): Promise<void> {
  try {
    const result = await api('quran.setState', { pages, state });
    offerUndo(
      result,
      `${pageRangeLabel(result.after.map((r) => r.page))} marked ${STATE_LABEL[state]}.`,
    );
  } catch (error) {
    fail(error);
  }
}

export async function learnNext(count: number): Promise<void> {
  try {
    const result = await api('quran.learnNext', { count });
    offerUndo(
      result,
      `Logged ${pageRangeLabel(result.after.map((r) => r.page))} as learned today.`,
    );
  } catch (error) {
    fail(error);
  }
}
