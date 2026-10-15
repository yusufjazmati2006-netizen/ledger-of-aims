import { useState } from 'react';
import { pageRangeLabel } from '@shared/domain/quran/mushaf';
import { upcomingLoad, type QueueSession } from '@shared/domain/quran/queue';
import { strength, type PageRecord, type Rating } from '@shared/domain/quran/scheduler';
import { addDays, formatDate, weekdayShort } from '@shared/domain/time/localDate';
import { durationLabel } from '@shared/domain/time/clockTime';
import { useApp } from '../../stores/app';
import { Card, EmptyState, Kbd, Pill } from '../../design/Card';
import { Button } from '../../design/Button';
import { Meter } from '../../design/Ring';
import { SegmentedControl } from '../../design/Field';
import { cx } from '../../lib/cx';
import { useQuran } from './useQuran';
import { ratePages, RATING_LABEL } from './actions';

const KIND_LABEL: Record<QueueSession['kind'], string> = {
  learning: 'Recently learned',
  revision: 'Relearning',
  rotation: 'Rotation',
};

const MINUTE_OPTIONS = [15, 30, 45, 60, 90];

export function RevisionPage() {
  const quran = useQuran();
  const updateSettings = useApp((s) => s.updateSettings);
  const { queue, streak, today } = quran;
  if (!queue) return null;
  const byPage = new Map(quran.records.map((r) => [r.page, r]));
  const load = upcomingLoad(quran.records, today, 8).slice(1);

  const setMinutes = (minutes: number) => {
    void updateSettings('quran', { todayMinutes: { date: today, minutes } });
  };
  const minuteOptions = MINUTE_OPTIONS.includes(quran.availableMinutes)
    ? MINUTE_OPTIONS
    : [...MINUTE_OPTIONS, quran.availableMinutes].sort((a, b) => a - b);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_260px]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-[22px] font-semibold">Today’s revision</h2>
            <p className="text-[13px] text-ink-muted" data-testid="queue-summary">
              {queue.dueCount === 0
                ? 'Nothing is due.'
                : `${queue.dueCount} page${queue.dueCount === 1 ? '' : 's'} due · ${queue.selected.length} fit in ${durationLabel(quran.availableMinutes)}${queue.backlog > 0 ? ` · ${queue.backlog} carry over to tomorrow` : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] text-ink-muted">Time today</span>
            <SegmentedControl
              size="sm"
              label="Revision time today"
              value={String(quran.availableMinutes)}
              onChange={(v) => setMinutes(Number(v))}
              options={minuteOptions.map((m) => ({ value: String(m), label: `${m}m` }))}
            />
          </div>
        </div>

        {queue.sessions.length === 0 ? (
          <EmptyState icon="check" title="Your revision is up to date">
            {queue.dueCount > 0
              ? 'Add a little time above to start on the pages that are due.'
              : 'Nothing is due today. The next few days are shown on the right; revising ahead is never wasted.'}
          </EmptyState>
        ) : (
          queue.sessions.map((session) => (
            <SessionCard
              key={`${session.kind}-${session.pages[0] ?? 0}`}
              session={session}
              records={session.pages
                .map((p) => byPage.get(p))
                .filter((r): r is PageRecord => r !== undefined)}
              today={today}
            />
          ))
        )}
        {queue.backlog > 0 ? (
          <p className="text-[12.5px] text-ink-muted">
            {queue.backlog} more due page{queue.backlog === 1 ? '' : 's'} did not fit. They stay due
            and rise to the top tomorrow; nothing is lost.
          </p>
        ) : null}
      </div>

      <aside className="flex flex-col gap-4">
        {streak ? (
          <Card className="p-4">
            <div className="eyebrow">Revision streak</div>
            <div className="mt-1 text-[24px] font-semibold text-ink" data-testid="revision-streak">
              {streak.length} day{streak.length === 1 ? '' : 's'}
            </div>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              {streak.todayDone
                ? 'Today counts.'
                : streak.atRisk
                  ? 'Revise today to keep it — your grace day is used.'
                  : `${streak.graceRemaining} grace day${streak.graceRemaining === 1 ? '' : 's'} left this week.`}
              {streak.longest > streak.length ? ` Longest: ${streak.longest} days.` : ''}
            </p>
          </Card>
        ) : null}
        <Card className="p-4">
          <div className="eyebrow mb-2">Coming up</div>
          <ul className="flex flex-col gap-1.5">
            {load.map((count, i) => {
              const date = addDays(today, i + 1);
              return (
                <li key={date} className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-20 text-ink-muted">
                    {weekdayShort(date)} {formatDate(date, { year: false })}
                  </span>
                  <Meter
                    value={count / Math.max(1, queue.capacity)}
                    label={`${count} pages due`}
                    className="flex-1"
                  />
                  <span className="tabular w-6 text-right text-ink">{count}</span>
                </li>
              );
            })}
          </ul>
        </Card>
        <p className="px-1 text-[12px] text-ink-faint">
          Keys: focus a page and press <Kbd>1</Kbd> solid, <Kbd>2</Kbd> shaky, <Kbd>3</Kbd>{' '}
          forgotten.
        </p>
      </aside>
    </div>
  );
}

function SessionCard({
  session,
  records,
  today,
}: {
  session: QueueSession;
  records: PageRecord[];
  today: string;
}) {
  const [busy, setBusy] = useState(false);
  const rateAll = async (rating: Rating) => {
    setBusy(true);
    await ratePages(session.pages, rating);
    setBusy(false);
  };
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3">
        <div className="flex items-center gap-2.5">
          <h3 className="font-serif text-[16px] font-semibold">
            Juz {session.juz} · {pageRangeLabel(session.pages)}
          </h3>
          <Pill
            tone={
              session.kind === 'revision'
                ? 'warning'
                : session.kind === 'learning'
                  ? 'accent'
                  : 'neutral'
            }
          >
            {KIND_LABEL[session.kind]}
          </Pill>
        </div>
        {session.pages.length > 1 ? (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void rateAll('solid')}>
            All solid
          </Button>
        ) : null}
      </div>
      <ul>
        {records.map((r) => (
          <PageRow key={r.page} record={r} today={today} />
        ))}
      </ul>
    </Card>
  );
}

const RATINGS: Rating[] = ['solid', 'shaky', 'forgotten'];

function PageRow({ record, today }: { record: PageRecord; today: string }) {
  const s = strength(record, today) ?? 0;
  return (
    <li
      tabIndex={0}
      aria-label={`Page ${record.page}, retention ${Math.round(s * 100)}%`}
      onKeyDown={(e) => {
        const rating = RATINGS[Number(e.key) - 1];
        if (rating) {
          e.preventDefault();
          void ratePages([record.page], rating);
        }
      }}
      className="flex items-center gap-4 border-b border-rule px-5 py-2.5 last:border-0 focus-visible:bg-sunken"
    >
      <span className="tabular w-16 text-[14px] font-semibold text-ink">p. {record.page}</span>
      <div className="flex w-40 items-center gap-2">
        <Meter value={s} label={`Retention ${Math.round(s * 100)}%`} className="flex-1" />
        <span className="tabular w-9 text-right text-[12px] text-ink-muted">
          {Math.round(s * 100)}%
        </span>
      </div>
      <span className="flex-1 text-[12px] text-ink-faint">
        {record.lastReviewedOn
          ? `last revised ${formatDate(record.lastReviewedOn, { year: false })}`
          : 'not yet revised here'}
        {record.lapses > 0 ? ` · ${record.lapses} lapse${record.lapses === 1 ? '' : 's'}` : ''}
      </span>
      <div className="flex gap-1.5" role="group" aria-label={`Rate page ${record.page}`}>
        {RATINGS.map((rating, i) => (
          <button
            key={rating}
            type="button"
            onClick={() => void ratePages([record.page], rating)}
            className={cx(
              'h-7 rounded-md border px-2.5 text-[12px] font-medium transition-colors',
              rating === 'solid' &&
                'border-rule-strong text-ink hover:border-positive hover:bg-positive-soft hover:text-positive',
              rating === 'shaky' &&
                'border-rule-strong text-ink hover:border-warning hover:bg-warning-soft hover:text-warning',
              rating === 'forgotten' &&
                'border-rule-strong text-ink hover:border-critical hover:bg-critical-soft hover:text-critical',
            )}
            aria-label={`${RATING_LABEL[rating]} (key ${i + 1})`}
          >
            {RATING_LABEL[rating]}
          </button>
        ))}
      </div>
    </li>
  );
}
