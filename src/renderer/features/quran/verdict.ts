import type { PaceResult, Verdict } from '@shared/domain/quran/pace';
import type { PillTone } from '../../design/Card';

export const VERDICT_TONE: Record<Verdict, PillTone> = {
  ahead: 'positive',
  'on-track': 'accent',
  behind: 'warning',
};

export function verdictHeadline(pace: PaceResult): string {
  const pages = Math.abs(pace.deficit);
  if (pace.verdict === 'on-track') {
    return pace.deficit === 0
      ? 'Exactly on track'
      : `On track (${pace.deficit > 0 ? '+' : '−'}${pages} page${pages === 1 ? '' : 's'})`;
  }
  return `${pace.verdict === 'ahead' ? 'Ahead' : 'Behind'} by ${pages} page${pages === 1 ? '' : 's'}`;
}
