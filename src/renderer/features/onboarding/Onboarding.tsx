import { useMemo, useState, type ReactNode, type SyntheticEvent } from 'react';
import {
  addDays,
  diffDays,
  formatDate,
  startOfWeek,
  weekdayShort,
} from '@shared/domain/time/localDate';
import { nextMilestone } from '@shared/domain/milestones/milestones';
import { GOAL_IDS } from '@shared/schemas/common';
import { useApp, useSettings, useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { api, ApiError } from '../../lib/api';
import { parseDecimal, unitToKg, type WeightUnit } from '../../lib/units';
import { Button } from '../../design/Button';
import { LabeledInput, SegmentedControl } from '../../design/Field';
import { Icon } from '../../design/icons';
import { GOAL_META } from '../../lib/goals';
import { cx } from '../../lib/cx';

type Step = 'welcome' | 'weight' | 'shifts' | 'ready';
const STEPS: Step[] = ['welcome', 'weight', 'shifts', 'ready'];

/**
 * First-launch flow. It collects only what the app cannot sensibly guess — the
 * starting weight and this week's shifts — and then shows the seeded goals.
 */
export function Onboarding() {
  const today = useToday();
  const settings = useSettings();
  const bootstrap = useApp((s) => s.bootstrap);
  const [step, setStep] = useState<Step>('welcome');
  const [unit, setUnit] = useState<WeightUnit>(settings.general.units);
  const [weightText, setWeightText] = useState('');
  const [weightError, setWeightError] = useState<string | null>(null);
  const weekStart = startOfWeek(today, settings.general.weekStartsOn);
  const week = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const [shifts, setShifts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const stepIndex = STEPS.indexOf(step);

  const submitWeight = (e: SyntheticEvent) => {
    e.preventDefault();
    const value = parseDecimal(weightText);
    const kg = value === null ? null : unitToKg(value, unit);
    if (kg === null || kg < 25 || kg > 350) {
      setWeightError(
        unit === 'kg'
          ? 'Enter a weight between 25 and 350 kg.'
          : 'Enter a weight between 55 and 770 lb.',
      );
      return;
    }
    setWeightError(null);
    setStep('shifts');
  };

  const finish = async () => {
    const value = parseDecimal(weightText);
    if (value === null) {
      setStep('weight');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await api('onboarding.complete', {
        startWeightKg: unitToKg(value, unit),
        units: unit,
        weekShifts: Object.entries(shifts).map(([date, shiftTypeId]) => ({ date, shiftTypeId })),
      });
      await bootstrap();
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : 'Could not save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-paper">
      <div className="drag-region h-[52px] shrink-0" />
      <div className="flex flex-1 items-start justify-center overflow-y-auto px-8 pb-16">
        <div className="w-full max-w-[560px] pt-[6vh]">
          <ol className="mb-10 flex gap-1.5" aria-label="Onboarding progress">
            {STEPS.map((s, i) => (
              <li
                key={s}
                aria-current={s === step ? 'step' : undefined}
                className={cx(
                  'h-1 flex-1 rounded-full transition-colors duration-300',
                  i <= stepIndex ? 'bg-ink' : 'bg-rule',
                )}
              >
                <span className="sr-only">
                  Step {i + 1} of {STEPS.length}
                </span>
              </li>
            ))}
          </ol>

          {step === 'welcome' ? (
            <StepFrame
              eyebrow="Welcome"
              title="A quiet ledger for four long aims."
              body={
                <>
                  <p>
                    Ledger of Aims keeps your memorisation, training, studies and game in one calm
                    place, and tells you what to do with the time your shifts leave you.
                  </p>
                  <p className="mt-3 flex items-start gap-2">
                    <Icon name="lock" size={16} className="mt-[3px] shrink-0 text-ink-faint" />
                    <span>
                      Everything stays on this Mac. There are no accounts, no cloud and no network
                      requests — ever.
                    </span>
                  </p>
                </>
              }
            >
              <Button
                variant="primary"
                size="lg"
                iconRight="arrowRight"
                onClick={() => {
                  setStep('weight');
                }}
                autoFocus
              >
                Begin
              </Button>
            </StepFrame>
          ) : null}

          {step === 'weight' ? (
            <form onSubmit={submitWeight}>
              <StepFrame
                eyebrow="Step 1 of 2"
                title="Your starting weight"
                body={
                  <p>
                    This anchors your physique trajectory towards 86 kg. Use a recent morning
                    weigh-in; you can refine it any time.
                  </p>
                }
              >
                <div className="flex flex-col gap-4">
                  <SegmentedControl
                    label="Weight unit"
                    value={unit}
                    onChange={setUnit}
                    options={[
                      { value: 'kg', label: 'Kilograms' },
                      { value: 'lb', label: 'Pounds' },
                    ]}
                  />
                  <LabeledInput
                    label="Weight"
                    inputMode="decimal"
                    autoFocus
                    placeholder={unit === 'kg' ? 'e.g. 66.4' : 'e.g. 146.4'}
                    value={weightText}
                    suffix={unit}
                    error={weightError}
                    onChange={(e) => {
                      setWeightText(e.target.value);
                    }}
                    className="max-w-[220px]"
                  />
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" variant="primary" size="lg" iconRight="arrowRight">
                      Continue
                    </Button>
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={() => {
                        setStep('welcome');
                      }}
                    >
                      Back
                    </Button>
                  </div>
                </div>
              </StepFrame>
            </form>
          ) : null}

          {step === 'shifts' ? (
            <ShiftStep
              week={week}
              today={today}
              shifts={shifts}
              onChange={setShifts}
              onBack={() => {
                setStep('weight');
              }}
              onNext={() => {
                setStep('ready');
              }}
            />
          ) : null}

          {step === 'ready' ? (
            <ReadyStep
              today={today}
              saving={saving}
              error={saveError}
              onFinish={() => void finish()}
              onBack={() => {
                setStep('shifts');
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StepFrame({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="animate-fade-in" aria-labelledby="onboarding-title">
      <p className="eyebrow mb-3">{eyebrow}</p>
      <h1
        id="onboarding-title"
        className="font-serif text-[38px] leading-[1.08] font-semibold tracking-[-0.02em] text-ink"
      >
        {title}
      </h1>
      <div className="mt-4 text-[15px] leading-relaxed text-ink-muted">{body}</div>
      <div className="mt-8">{children}</div>
    </section>
  );
}

const SHIFT_OPTIONS = [
  { value: 'morning', label: 'Morning' },
  { value: 'night', label: 'Night' },
  { value: 'off', label: 'Off' },
] as const;

function ShiftStep({
  week,
  today,
  shifts,
  onChange,
  onBack,
  onNext,
}: {
  week: string[];
  today: string;
  shifts: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const fillAll = (value: string) => {
    onChange(Object.fromEntries(week.map((d) => [d, value])));
  };
  return (
    <StepFrame
      eyebrow="Step 2 of 2"
      title="This week’s shifts"
      body={
        <p>
          Morning is 07:30–16:30 and night is 16:00–01:00 (both editable in Settings). The planner
          uses these to find realistic time and never schedules you into the hours after a night
          shift. Leave a day blank if you don’t know yet.
        </p>
      }
    >
      <div className="flex flex-col gap-1.5">
        {week.map((date) => {
          const isToday = date === today;
          return (
            <div
              key={date}
              className={cx(
                'flex items-center justify-between rounded-lg px-3 py-2',
                isToday ? 'bg-surface ring-1 ring-rule' : '',
              )}
            >
              <span className="text-[13.5px] text-ink">
                <span className="inline-block w-10 font-medium">{weekdayShort(date)}</span>
                <span className="text-ink-muted">{formatDate(date, { year: false })}</span>
                {isToday ? <span className="ml-2 eyebrow !text-ink-muted">today</span> : null}
              </span>
              <SegmentedControl
                size="sm"
                label={`Shift on ${formatDate(date)}`}
                value={(shifts[date] ?? '') as 'morning' | 'night' | 'off' | ''}
                onChange={(value) => {
                  onChange({ ...shifts, [date]: value });
                }}
                options={SHIFT_OPTIONS}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2 text-[12.5px] text-ink-muted">
        <span>Fill the week:</span>
        {SHIFT_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            className="font-medium text-ink underline-offset-2 hover:underline"
            onClick={() => {
              fillAll(o.value);
            }}
          >
            {o.label.toLowerCase()}
          </button>
        ))}
      </div>
      <div className="mt-8 flex gap-2">
        <Button variant="primary" size="lg" iconRight="arrowRight" onClick={onNext}>
          Continue
        </Button>
        <Button variant="ghost" size="lg" onClick={onBack}>
          Back
        </Button>
      </div>
    </StepFrame>
  );
}

function ReadyStep({
  today,
  saving,
  error,
  onFinish,
  onBack,
}: {
  today: string;
  saving: boolean;
  error: string | null;
  onFinish: () => void;
  onBack: () => void;
}) {
  const goals = useLedger('goals.list', undefined);
  const milestones = useLedger('milestones.list', undefined);
  return (
    <StepFrame
      eyebrow="Ready"
      title="Your four aims are in place."
      body={
        <p>
          Milestones from your plan have been laid out from {formatDate(today)}. Every date is
          editable.
        </p>
      }
    >
      <ul className="mb-8 flex flex-col divide-y divide-rule rounded-xl border border-rule bg-surface">
        {GOAL_IDS.map((id) => {
          const goal = goals.data?.find((g) => g.id === id);
          const next = milestones.data ? nextMilestone(milestones.data, id) : undefined;
          return (
            <li key={id} data-goal={id} className="flex items-center gap-3 px-4 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Icon name={GOAL_META[id].icon} size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium text-ink">
                  {goal?.title ?? GOAL_META[id].short}
                </div>
                {next ? (
                  <div className="text-[12.5px] text-ink-muted">
                    {next.title} · {formatDate(next.targetDate)}
                  </div>
                ) : null}
              </div>
              {next ? (
                <span className="tabular text-[12px] text-ink-faint">
                  {Math.max(0, diffDays(today, next.targetDate))} days
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="mb-4 text-[13px] text-critical">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="lg"
          iconRight="arrowRight"
          onClick={onFinish}
          disabled={saving}
          autoFocus
        >
          {saving ? 'Saving…' : 'Open today'}
        </Button>
        <Button variant="ghost" size="lg" onClick={onBack} disabled={saving}>
          Back
        </Button>
      </div>
      {milestones.data ? (
        <p className="mt-6 text-[12px] text-ink-faint">
          {milestones.data.length} milestones seeded across the four goals.
        </p>
      ) : null}
    </StepFrame>
  );
}
