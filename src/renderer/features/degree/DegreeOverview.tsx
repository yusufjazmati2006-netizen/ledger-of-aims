import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { nextDeadlines } from '@shared/domain/degree/deadlines';
import { project, withWhatIf, type Requirement } from '@shared/domain/degree/classification';
import { formatDate } from '@shared/domain/time/localDate';
import { useToday } from '../../stores/app';
import { parseDecimal } from '../../lib/units';
import { cx } from '../../lib/cx';
import { Card, EmptyState, Note, Pill, SectionTitle, type PillTone } from '../../design/Card';
import { TextInput } from '../../design/Field';
import { DeadlineCountdown } from './DeadlineCountdown';
import { isDone, useDegree } from './useDegree';

function describe(r: Requirement): { text: string; tone: PillTone; detail: string } {
  switch (r.status) {
    case 'secured':
      return {
        text: 'Secured',
        tone: 'positive',
        detail: 'Even zero on everything remaining would keep it.',
      };
    case 'achievable':
      return {
        text: `${r.mark.toFixed(1)}% average needed`,
        // Neutral unless the bar is genuinely high; the oxblood accent would read as alarm.
        tone: r.mark >= 75 ? 'warning' : 'neutral',
        detail: 'Across all remaining assessments in counted years.',
      };
    case 'out-of-reach':
      return {
        text: 'Out of reach',
        tone: 'critical',
        detail: Number.isFinite(r.mark)
          ? `It would need ${r.mark.toFixed(1)}% on everything remaining.`
          : 'Everything is already graded.',
      };
    case 'not-counting':
      return {
        text: '—',
        tone: 'neutral',
        detail: 'No year counts towards the classification in Settings.',
      };
  }
}

export function DegreeOverview() {
  const today = useToday();
  const degree = useDegree();
  const { projection } = degree;
  const upcoming = nextDeadlines(
    degree.deadlines.map((a) => ({ ...a, due: a.dueDate ?? '', done: isDone(a) })),
    today,
    3,
  );

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="deadlines">
        <SectionTitle
          id="deadlines"
          action={
            <Link
              to="/degree/calendar"
              className="text-[12.5px] font-medium text-ink-muted hover:text-ink"
            >
              Calendar
            </Link>
          }
        >
          Next deadlines
        </SectionTitle>
        {upcoming.length === 0 ? (
          <EmptyState icon="calendar" title="No deadlines yet">
            Term dates are not confirmed yet, so nothing is invented. Add each assessment with its
            due date under{' '}
            <Link
              to="/degree/modules"
              className="font-medium text-ink underline underline-offset-2"
            >
              Modules
            </Link>{' '}
            and the countdowns appear here, growing more urgent as they approach.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {upcoming.map((a) => (
              <DeadlineCountdown
                key={a.id}
                title={a.title}
                subtitle={a.module?.code || a.module?.title}
                due={a.due}
                today={today}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="eyebrow">Projected classification</div>
          {projection.projected === null ? (
            <>
              <h2 className="mt-1 font-serif text-[26px] font-semibold text-ink">No grades yet</h2>
              <p className="mt-2 text-[13px] text-ink-muted">
                The projection starts with your first graded assessment in a counted year (Level 5
                or 6 by default).
              </p>
            </>
          ) : (
            <>
              <div className="mt-1 flex items-baseline gap-3">
                <span
                  className="text-[44px] leading-none font-semibold text-ink"
                  data-testid="projected-mark"
                >
                  {projection.projected.toFixed(1)}%
                </span>
                <Pill
                  tone={
                    projection.band === 'First'
                      ? 'positive'
                      : projection.band === '2:1'
                        ? 'accent'
                        : 'warning'
                  }
                >
                  {projection.band}
                </Pill>
              </div>
              <p className="mt-2 text-[13px] text-ink-muted">
                Based on graded work worth {(projection.coverage * 100).toFixed(1)}% of the final
                classification. Early projections move a lot.
              </p>
            </>
          )}
          <div className="mt-4">
            <Note>
              Weighting: Level 5 × {degree.rules.levelWeights[5]}, Level 6 ×{' '}
              {degree.rules.levelWeights[6]}
              {degree.rules.levelWeights[4] > 0
                ? `, Level 4 × ${degree.rules.levelWeights[4]}`
                : ' (Level 4 not counted)'}
              . This is a common UK convention, not confirmed for Arden — check the academic
              regulations and adjust in Settings → Degree.
            </Note>
          </div>
        </Card>

        <Card className="p-6">
          <div className="eyebrow">What do I need?</div>
          <ul className="mt-3 flex flex-col gap-3">
            {degree.requirements.map((r) => {
              const d = describe(r.requirement);
              return (
                <li
                  key={r.label}
                  className="flex items-start justify-between gap-4 border-b border-rule pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <div className="text-[14px] font-semibold text-ink">
                      {r.label} <span className="font-normal text-ink-faint">({r.target}%+)</span>
                    </div>
                    <div className="text-[12.5px] text-ink-muted">{d.detail}</div>
                  </div>
                  <Pill tone={d.tone}>{d.text}</Pill>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[12px] text-ink-faint">
            Credits not yet entered count as remaining work ({degree.rules.creditsPerLevel} credits
            a level), so the figures are honest from the start.
          </p>
        </Card>
      </div>

      <WhatIf />
    </div>
  );
}

/** Try hypothetical grades on ungraded work and watch the projection move. */
function WhatIf() {
  const degree = useDegree();
  const [values, setValues] = useState<Record<string, string>>({});
  const ungraded = degree.data.assessments.filter((a) => a.grade === null);
  const hypothetical = useMemo(() => {
    const map = new Map<string, number>();
    for (const [id, text] of Object.entries(values)) {
      const v = parseDecimal(text);
      if (v !== null && v >= 0 && v <= 100) map.set(id, v);
    }
    return map;
  }, [values]);
  if (ungraded.length === 0) return null;
  const result = project(withWhatIf(degree.modules, hypothetical), degree.rules);
  const moduleOf = new Map(degree.data.modules.map((m) => [m.id, m]));

  return (
    <section aria-labelledby="what-if">
      <SectionTitle id="what-if">What if…</SectionTitle>
      <Card as="div" className="p-5">
        <p className="mb-4 text-[13px] text-ink-muted">
          Enter marks you think you might get. Nothing is saved; the projection updates as you type.
        </p>
        <div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
          {ungraded.map((a) => {
            const m = moduleOf.get(a.moduleId);
            return (
              <label key={a.id} className="flex items-center gap-3 text-[13px]">
                <span className="min-w-0 flex-1 truncate text-ink">
                  {a.title}
                  <span className="ml-1.5 text-ink-faint">
                    {m?.code || m?.title} · {a.weight}%
                    {a.dueDate ? ` · ${formatDate(a.dueDate, { year: false })}` : ''}
                  </span>
                </span>
                <TextInput
                  aria-label={`What-if mark for ${a.title}`}
                  inputMode="decimal"
                  placeholder="—"
                  className="w-[72px]"
                  value={values[a.id] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [a.id]: e.target.value }))}
                />
              </label>
            );
          })}
        </div>
        <div
          className={cx(
            'mt-4 border-t border-rule pt-3 text-[13.5px]',
            hypothetical.size === 0 && 'text-ink-faint',
          )}
        >
          {result.projected === null
            ? 'Enter a mark to see a projection.'
            : `With these marks: ${result.projected.toFixed(1)}% — ${result.band ?? ''}`}
        </div>
      </Card>
    </section>
  );
}
