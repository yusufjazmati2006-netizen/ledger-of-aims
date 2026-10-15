import { useMemo, useState } from 'react';
import { pageRangeLabel } from '@shared/domain/quran/mushaf';
import { weeklyLearned } from '@shared/domain/quran/pace';
import { diffDays, formatDate, startOfWeek, weekdayShort } from '@shared/domain/time/localDate';
import { useSettings } from '../../stores/app';
import { Card, EmptyState, SectionTitle, Stat } from '../../design/Card';
import { Button, IconButton } from '../../design/Button';
import { BarChartCard } from '../../design/charts/BarChartCard';
import { useTokenColors } from '../../design/charts/colors';
import { useQuran } from './useQuran';
import { learnNext } from './actions';

export function LearningLogPage() {
  const quran = useQuran();
  const settings = useSettings();
  const colors = useTokenColors(['quran'] as const);
  const [count, setCount] = useState(1);

  // Weeks since the plan began (at most 12): earlier weeks have no data to show.
  const planWeeks =
    Math.floor(
      diffDays(
        startOfWeek(settings.general.planStartDate, settings.general.weekStartsOn),
        startOfWeek(quran.today, settings.general.weekStartsOn),
      ) / 7,
    ) + 1;
  const weeks = weeklyLearned(
    quran.records,
    quran.today,
    Math.min(12, Math.max(1, planWeeks)),
    settings.general.weekStartsOn,
  );
  const plannedPace =
    quran.pace && quran.pace.targetPacePerWeek > 0
      ? quran.pace.targetPacePerWeek
      : quran.settings.baselinePagesPerWeek;
  const byDay = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const r of quran.records) {
      if (!r.learnedOn) continue;
      map.set(r.learnedOn, [...(map.get(r.learnedOn) ?? []), r.page]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [quran.records]);
  const preview = quran.nextPages.slice(0, count);

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-wrap items-center gap-6 p-6">
        <div className="min-w-[220px] flex-1">
          <h2 className="font-serif text-[19px] font-semibold">Pages learned today</h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            Next in your order:{' '}
            <span className="font-medium text-ink">
              {preview.length > 0 ? pageRangeLabel(preview) : '—'}
            </span>
            {preview[0] ? ` (juz ${quran.layout.juzOfPage[preview[0]] ?? ''})` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-control p-1">
          <IconButton
            icon="minus"
            label="Fewer pages"
            size="sm"
            disabled={count <= 1}
            onClick={() => setCount((c) => Math.max(1, c - 1))}
          />
          <span
            className="tabular w-8 text-center text-[16px] font-semibold"
            aria-live="polite"
            aria-label={`${count} pages`}
          >
            {count}
          </span>
          <IconButton
            icon="plus"
            label="More pages"
            size="sm"
            disabled={count >= 20}
            onClick={() => setCount((c) => Math.min(20, c + 1))}
          />
        </div>
        <Button
          variant="accent"
          disabled={preview.length === 0}
          onClick={() => void learnNext(count).then(() => setCount(1))}
        >
          Log as learned today
        </Button>
      </Card>

      <Card className="p-6">
        {weeks.length < 3 ? (
          // A one- or two-bar chart says less than the number itself.
          <div className="flex flex-wrap gap-10">
            <Stat
              label="Pages this week"
              value={weeks[weeks.length - 1]?.pages ?? 0}
              hint={`Planned pace ${(Math.round(plannedPace * 10) / 10).toFixed(1)} a week`}
            />
            {weeks.length === 2 ? <Stat label="Last week" value={weeks[0]?.pages ?? 0} /> : null}
            <p className="max-w-[40ch] self-end text-[12.5px] text-ink-muted">
              A weekly chart appears once there are three weeks of history.
            </p>
          </div>
        ) : (
          <BarChartCard
            title="New pages per week"
            summary={`Pages learned in each of the last ${weeks.length} weeks; this week ${weeks[weeks.length - 1]?.pages ?? 0}. Planned pace ${plannedPace.toFixed(1)} per week.`}
            rows={weeks.map((w) => ({
              label: formatDate(w.weekStart, { year: false }),
              detail: `Week of ${formatDate(w.weekStart)}`,
              value: w.pages,
            }))}
            color={colors.quran}
            seriesLabel="Pages learned"
            unit="pages"
            reference={{ value: plannedPace, label: 'Planned pace' }}
          />
        )}
      </Card>

      <section aria-labelledby="daily-log">
        <SectionTitle id="daily-log">Daily log</SectionTitle>
        {byDay.length === 0 ? (
          <EmptyState icon="book" title="No pages logged yet">
            Each page you mark as learned appears here by date. Use “Log as learned today” above, or
            select specific pages in the Mushaf.
          </EmptyState>
        ) : (
          <Card as="div">
            <ul>
              {byDay.slice(0, 90).map(([date, pages]) => (
                <li
                  key={date}
                  className="flex items-baseline gap-4 border-b border-rule px-5 py-2.5 last:border-0"
                >
                  <span className="w-28 text-[13px] text-ink-muted">
                    {weekdayShort(date)}{' '}
                    {formatDate(date, { year: date.slice(0, 4) !== quran.today.slice(0, 4) })}
                  </span>
                  <span className="flex-1 text-[13.5px] text-ink">{pageRangeLabel(pages)}</span>
                  <span className="tabular text-[12.5px] text-ink-faint">
                    {pages.length} page{pages.length === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {byDay.length > 90 ? (
          <p className="mt-2 text-[12px] text-ink-faint">
            Showing the most recent 90 days with entries.
          </p>
        ) : null}
      </section>
    </div>
  );
}
