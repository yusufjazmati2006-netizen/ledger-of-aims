import { fromMinutes } from '@shared/domain/time/clockTime';
import type { PlanBlock } from '@shared/schemas/degree';
import { api } from '../../lib/api';

/**
 * Marks a block done. Study and game blocks also log their time, exactly as if it
 * had been logged on the Degree or Game screen; Quran and training are logged by the
 * pages rated and sets recorded, so their blocks only tick.
 */
export async function completeBlock(
  block: Pick<PlanBlock, 'id' | 'date' | 'start' | 'end' | 'goalId' | 'title'>,
): Promise<void> {
  const minutes = block.end - block.start;
  if (block.goalId === 'degree')
    await api('study.log', { date: block.date, minutes, note: block.title || 'Planned session' });
  if (block.goalId === 'game')
    await api('time.addManual', {
      date: block.date,
      start: fromMinutes(block.start),
      minutes,
      note: block.title,
    });
  await api('plan.update', { id: block.id, patch: { done: true } });
}
