import { useNavigate } from 'react-router';
import { addDays, diffDays, formatDate, maxDate, minDate } from '@shared/domain/time/localDate';
import { cumulativeLearned, startingPages } from '@shared/domain/quran/pace';
import { PAGES_PER_JUZ } from '@shared/domain/quran/mushaf';
import { useSettings } from '../../stores/app';
import { Card, Pill, SectionTitle, Stat } from '../../design/Card';
import { VERDICT_TONE, verdictHeadline } from './verdict';
import { Ring } from '../../design/Ring';
import { TimeChart } from '../../design/charts/TimeChart';
import { useTokenColors } from '../../design/charts/colors';
import { useQuran } from './useQuran';

const fmt1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

export function QuranOverview() {
  const quran = useQuran();
  const settings = useSettings();
  const navigate = useNavigate();
  const colors = useTokenColors(['quran', 'chart-reference'] as const);
  const { pace, today } = quran;
  if (!pace) return null;

  const planStart = settings.general.planStartDate;
  const end = pace.finalTarget?.date ?? addDays(today, 365);
  const chartEnd = pace.projectedCompletion
    ? minDate(maxDate(end, pace.projectedCompletion), addDays(end, 120))
    : end;
  const yMin = Math.max(0, Math.floor((startingPages(quran.records, planStart) - 1) / 100) * 100);
  const actual = cumulativeLearned(
    quran.records,
    planStart,
    today,
    startingPages(quran.records, planStart),
  );
  const projection =
    pace.projectedCompletion && pace.remaining > 0
      ? (() => {
          const stop = minDate(pace.projectedCompletion, chartEnd);
          const value = pace.learned + (pace.pacePerWeek / 7) * diffDays(today, stop);
          return [
            { date: today, value: pace.learned },
            { date: stop, value: Math.min(604, value) },
          ];
        })()
      : [];

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Against your plan today</div>
            <h2
              className="mt-1 font-serif text-[28px] leading-tight font-semibold text-ink"
              data-testid="quran-verdict"
            >
              {verdictHeadline(pace)}
            </h2>
            <p className="mt-1 text-[13.5px] text-ink-muted">
              {pace.learned} pages learned against a target of {Math.round(pace.targetToday)} today
              {pace.targetPacePerWeek > 0 && pace.verdict !== 'on-track'
                ? ` — about ${fmt1(Math.abs(pace.weeksEquivalent))} weeks at the planned ${fmt1(pace.targetPacePerWeek)} pages a week.`
                : '.'}
            </p>
          </div>
          <Pill
            tone={VERDICT_TONE[pace.verdict]}
            icon={pace.verdict === 'behind' ? 'alert' : 'check'}
          >
            {pace.verdict === 'on-track'
              ? 'On track'
              : pace.verdict === 'ahead'
                ? 'Ahead'
                : 'Behind'}
          </Pill>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-6 border-t border-rule pt-5 md:grid-cols-4">
          <Stat
            label="Memorised"
            value={pace.learned}
            unit="pages"
            hint={`≈ ${fmt1(pace.learned / PAGES_PER_JUZ)} juz · ${pace.remaining} to go`}
          />
          <Stat
            label="4-week pace"
            value={fmt1(pace.pacePerWeek)}
            unit="pages / week"
            hint={
              pace.blended
                ? `Blended with your ${quran.settings.baselinePagesPerWeek}/week baseline until 4 weeks of data`
                : `${pace.learnedLast28} pages in the last 28 days`
            }
          />
          <Stat
            label="Needed for next milestone"
            value={pace.next ? fmt1(pace.next.requiredPerWeek) : '—'}
            unit={pace.next ? 'pages / week' : undefined}
            hint={
              pace.next
                ? `${pace.next.pagesToGo} pages to ${pace.next.juz} juz by ${formatDate(pace.next.date)}`
                : 'All milestones reached'
            }
          />
          <Stat
            label="Projected completion"
            value={pace.projectedCompletion ? formatDate(pace.projectedCompletion) : '—'}
            hint={
              pace.projectedSlipDays === null
                ? 'Log some pages to project a date'
                : pace.projectedSlipDays > 0
                  ? `${pace.projectedSlipDays} days after ${formatDate(pace.finalTarget?.date ?? today)}`
                  : `${-pace.projectedSlipDays} days before your target`
            }
          />
        </div>
      </Card>

      <Card className="p-6">
        <TimeChart
          title="Pages memorised against the plan"
          summary={`Learned pages rise from ${actual[0]?.value ?? 0} on ${formatDate(planStart)} to ${pace.learned} today; the plan targets ${Math.round(pace.targetToday)} today and ${pace.finalTarget?.pages ?? 604} by ${formatDate(end)}.`}
          today={today}
          unit="pages"
          yDomain={[yMin, 604]}
          yTicks={[
            ...Array.from(
              { length: Math.floor((604 - yMin) / 100) + 1 },
              (_, i) => yMin + i * 100,
            ).filter((t) => 604 - t >= 40),
            604,
          ]}
          series={[
            {
              key: 'target',
              label: 'Plan',
              color: colors['chart-reference'],
              reference: true,
              points: [...pace.targetLine.filter((p) => p.date <= chartEnd)],
            },
            { key: 'actual', label: 'Memorised', color: colors.quran, points: actual },
            ...(projection.length > 0
              ? [
                  {
                    key: 'projection',
                    label: 'Projection at current pace',
                    color: colors.quran,
                    dashed: true,
                    points: projection,
                  },
                ]
              : []),
          ]}
        />
      </Card>

      <section aria-labelledby="juz-overview">
        <SectionTitle id="juz-overview">Juz overview</SectionTitle>
        <p className="-mt-1 mb-4 text-[12.5px] text-ink-muted">
          The ring shows how much of each juz is learned; the figure beneath is its estimated
          retention.
        </p>
        <ul className="grid grid-cols-5 gap-3 sm:grid-cols-6 lg:grid-cols-10">
          {quran.juz.map((j) => (
            <li key={j.juz}>
              <button
                type="button"
                onClick={() => void navigate(`/quran/mushaf?juz=${j.juz}`)}
                className="flex w-full flex-col items-center gap-1 rounded-lg py-2 transition-colors hover:bg-sunken"
                aria-label={`Juz ${j.juz}: ${j.learned} of ${j.size} pages learned${j.strength !== null ? `, retention ${Math.round(j.strength * 100)}%` : ''}${j.revision > 0 ? `, ${j.revision} needing revision` : ''}`}
              >
                <Ring value={j.learned / j.size} size={46} stroke={4} label="">
                  <span className="tabular text-[12px] font-semibold text-ink">{j.juz}</span>
                </Ring>
                <span className="tabular text-[11px] text-ink-faint">
                  {j.strength !== null ? `${Math.round(j.strength * 100)}%` : '—'}
                  {j.revision > 0 ? <span className="ml-0.5 text-warning">•</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
