import { addDays, formatDate } from '@shared/domain/time/localDate';
import { useSettings } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { formatWeight } from '../../lib/units';
import { Card, EmptyState, Pill } from '../../design/Card';
import { MetricsGrid } from './MetricsGrid';

/** Every past review, newest first, with the figures recorded when it was completed. */
export function HistoryPage() {
  const settings = useSettings();
  const reviews = useLedger('review.list', undefined, { domains: ['review'] });
  const list = reviews.data ?? [];
  if (reviews.data === undefined) return <div className="h-[300px]" />;
  if (list.length === 0) {
    return (
      <EmptyState icon="review" title="No reviews yet">
        Your first review appears here once you save it. Over months, this becomes the honest record
        of how the plan met real weeks.
      </EmptyState>
    );
  }
  return (
    <ol className="flex flex-col gap-4">
      {list.map((r) => (
        <li key={r.weekStart}>
          <Card as="article" className="p-6" aria-labelledby={`rv-${r.weekStart}`}>
            <header className="mb-4 flex items-baseline justify-between gap-4">
              <h2
                id={`rv-${r.weekStart}`}
                className="font-serif text-[19px] font-semibold text-ink"
              >
                Week of {formatDate(r.weekStart)}
              </h2>
              {r.completedAt ? (
                <span className="text-[12px] text-ink-faint">
                  to {formatDate(addDays(r.weekStart, 6), { year: false })}
                </span>
              ) : (
                <Pill>Draft</Pill>
              )}
            </header>
            {r.metrics ? (
              <MetricsGrid
                m={r.metrics}
                unitWeight={(kg) => formatWeight(kg, settings.general.units)}
              />
            ) : null}
            <dl className="mt-4 grid grid-cols-1 gap-4 border-t border-rule pt-4 text-[13px] lg:grid-cols-3">
              {(
                [
                  ['Went well', r.wentWell],
                  ['Got in the way', r.wentBadly],
                  ['Changing', r.adjust],
                ] as const
              ).map(([label, text]) => (
                <div key={label}>
                  <dt className="eyebrow mb-1">{label}</dt>
                  <dd className="whitespace-pre-wrap text-ink">{text || '—'}</dd>
                </div>
              ))}
            </dl>
            {r.priorities.length > 0 ? (
              <div className="mt-4 text-[13px]">
                <div className="eyebrow mb-1">Priorities for the next week</div>
                <ol className="list-decimal pl-5 text-ink">
                  {r.priorities.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ol>
              </div>
            ) : null}
          </Card>
        </li>
      ))}
    </ol>
  );
}
