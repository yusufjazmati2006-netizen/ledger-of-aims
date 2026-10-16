import { useState } from 'react';
import {
  addDays,
  formatDate,
  localDateOf,
  startOfWeek,
  type LocalDate,
} from '@shared/domain/time/localDate';
import type { WeeklyReview } from '@shared/schemas/review';
import { useSettings, useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { api, ApiError } from '../../lib/api';
import { formatWeight } from '../../lib/units';
import { toast } from '../../stores/toasts';
import { Card, Note, Pill, SectionTitle } from '../../design/Card';
import { Button } from '../../design/Button';
import { Field, SegmentedControl, TextArea, TextInput } from '../../design/Field';
import { MetricsGrid } from './MetricsGrid';
import { defaultReviewWeek } from './weeks';

export function ReviewWeekPage() {
  const today = useToday();
  const settings = useSettings();
  const current = startOfWeek(today, settings.general.weekStartsOn);
  const lastWeek = addDays(current, -7);
  const last = useLedger('review.get', { weekStart: lastWeek }, { domains: ['review'] });
  const [chosen, setChosen] = useState<LocalDate | null>(null);
  if (last.data === undefined) return <div className="h-[400px]" />;
  const weekStart =
    chosen ??
    defaultReviewWeek(today, settings.general.weekStartsOn, Boolean(last.data?.completedAt));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Week to review"
          value={weekStart === current ? 'current' : 'last'}
          onChange={(v) => setChosen(v === 'current' ? current : lastWeek)}
          options={[
            { value: 'last', label: `Last week (from ${formatDate(lastWeek, { year: false })})` },
            { value: 'current', label: `This week (from ${formatDate(current, { year: false })})` },
          ]}
        />
        {weekStart === lastWeek && !last.data?.completedAt ? (
          <span className="text-[12.5px] text-ink-muted">Last week’s review is still open.</span>
        ) : null}
      </div>
      <ReviewForm key={weekStart} weekStart={weekStart} />
    </div>
  );
}

function ReviewForm({ weekStart }: { weekStart: LocalDate }) {
  const settings = useSettings();
  const review = useLedger('review.get', { weekStart }, { domains: ['review'] });
  const previous = useLedger(
    'review.get',
    { weekStart: addDays(weekStart, -7) },
    { domains: ['review'] },
  );
  const metrics = useLedger(
    'review.metrics',
    { weekStart },
    {
      domains: ['review', 'plan', 'quran', 'training', 'weighIns', 'degree', 'game', 'milestones'],
    },
  );
  if (review.data === undefined) return <div className="h-[400px]" />;
  return (
    <>
      <Card className="p-6" aria-labelledby="week-figures">
        <SectionTitle
          id="week-figures"
          action={
            review.data?.completedAt ? (
              <Pill tone="positive" icon="check">
                Reviewed
              </Pill>
            ) : (
              <span className="text-[12.5px] text-ink-faint">
                {formatDate(weekStart, { year: false })} – {formatDate(addDays(weekStart, 6))}
              </span>
            )
          }
        >
          The week in figures
        </SectionTitle>
        {metrics.data ? (
          <MetricsGrid
            m={metrics.data}
            unitWeight={(kg) => formatWeight(kg, settings.general.units)}
          />
        ) : (
          <div className="h-[80px]" />
        )}
      </Card>

      {previous.data && previous.data.priorities.length > 0 ? (
        <Card className="p-6" aria-labelledby="set-priorities">
          <SectionTitle id="set-priorities">The priorities you set for this week</SectionTitle>
          <ol className="list-decimal pl-5 text-[13.5px] text-ink">
            {previous.data.priorities.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </Card>
      ) : null}

      <ReflectionForm weekStart={weekStart} review={review.data} />
    </>
  );
}

function ReflectionForm({
  weekStart,
  review,
}: {
  weekStart: LocalDate;
  review: WeeklyReview | null;
}) {
  const today = useToday();
  const settings = useSettings();
  const [wentWell, setWentWell] = useState(review?.wentWell ?? '');
  const [wentBadly, setWentBadly] = useState(review?.wentBadly ?? '');
  const [adjust, setAdjust] = useState(review?.adjust ?? '');
  const [priorities, setPriorities] = useState<string[]>(() => {
    const p = review?.priorities ?? [];
    return [p[0] ?? '', p[1] ?? '', p[2] ?? ''];
  });
  const [error, setError] = useState<string | null>(null);

  const save = async (complete: boolean) => {
    try {
      await api('review.save', { weekStart, priorities, wentWell, wentBadly, adjust, complete });
      setError(null);
      toast.success(
        !complete
          ? 'Draft saved.'
          : weekStart < startOfWeek(today, settings.general.weekStartsOn)
            ? 'Review complete. Your priorities now show on Today.'
            : 'Review complete. Your priorities will show on Today next week.',
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the review.');
    }
  };

  return (
    <Card className="p-6" aria-labelledby="reflections">
      <SectionTitle id="reflections">Reflections</SectionTitle>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Field label="What went well?" htmlFor="rv-well">
          <TextArea id="rv-well" value={wentWell} onChange={(e) => setWentWell(e.target.value)} />
        </Field>
        <Field label="What got in the way?" htmlFor="rv-badly">
          <TextArea
            id="rv-badly"
            value={wentBadly}
            onChange={(e) => setWentBadly(e.target.value)}
          />
        </Field>
        <Field label="What will you change?" htmlFor="rv-adjust">
          <TextArea id="rv-adjust" value={adjust} onChange={(e) => setAdjust(e.target.value)} />
        </Field>
      </div>
      <h3 className="mt-6 mb-2 text-[13.5px] font-semibold text-ink">
        Three priorities for next week
      </h3>
      <div className="flex flex-col gap-2">
        {priorities.map((p, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="tabular w-4 text-[13px] text-ink-faint">{i + 1}.</span>
            <TextInput
              aria-label={`Priority ${i + 1}`}
              value={p}
              maxLength={200}
              placeholder={i === 0 ? 'The one thing that would make next week a success' : ''}
              onChange={(e) =>
                setPriorities(priorities.map((q, j) => (j === i ? e.target.value : q)))
              }
            />
          </div>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-[12.5px] text-critical">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex items-center justify-end gap-2">
        {review?.completedAt ? (
          <span className="mr-auto text-[12.5px] text-ink-muted">
            Completed {formatDate(localDateOf(new Date(review.completedAt)))}. Saving again updates
            it.
          </span>
        ) : (
          <span className="mr-auto">
            <Note>Completing the review records this week’s figures alongside your notes.</Note>
          </span>
        )}
        <Button variant="ghost" onClick={() => void save(false)}>
          Save draft
        </Button>
        <Button variant="accent" icon="check" onClick={() => void save(true)}>
          Complete review
        </Button>
      </div>
    </Card>
  );
}
