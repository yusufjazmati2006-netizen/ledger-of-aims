import { useState, type ReactNode } from 'react';
import { MADANI_JUZ_START_PAGES, validateJuzStarts } from '@shared/domain/quran/mushaf';
import { DEFAULT_SCHEDULER } from '@shared/domain/quran/scheduler';
import type { QuranSettings as QuranSettingsT } from '@shared/schemas/settings';
import { useApp, useSettings } from '../../stores/app';
import { toast } from '../../stores/toasts';
import { ApiError } from '../../lib/api';
import { parseDecimal } from '../../lib/units';
import { Field, SegmentedControl, Select, TextArea, TextInput } from '../../design/Field';
import { Button } from '../../design/Button';

type Scheduler = QuranSettingsT['scheduler'];

/** One numeric setting, validated and saved when the field loses focus. */
function NumberSetting({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  suffix,
  onSave,
}: {
  label: string;
  hint?: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onSave: (value: number) => Promise<void>;
}) {
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const id = `n-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <div className="flex items-center gap-2">
        <TextInput
          id={id}
          inputMode="decimal"
          className="w-[110px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const n = parseDecimal(text);
            if (n === null || n < min || n > max || (step >= 1 && !Number.isInteger(n))) {
              setError(`Enter ${step >= 1 ? 'a whole number' : 'a number'} from ${min} to ${max}.`);
              return;
            }
            setError(null);
            if (n !== value) void onSave(n);
          }}
        />
        {suffix ? <span className="text-[12.5px] text-ink-faint">{suffix}</span> : null}
      </div>
    </Field>
  );
}

function StepsSetting({
  label,
  hint,
  value,
  onSave,
}: {
  label: string;
  hint: string;
  value: number[];
  onSave: (steps: number[]) => Promise<void>;
}) {
  const [text, setText] = useState(value.join(', '));
  const [error, setError] = useState<string | null>(null);
  const id = `steps-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <TextInput
        id={id}
        className="w-[200px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const steps = text
            .split(/[,\s]+/)
            .filter(Boolean)
            .map(Number);
          if (
            steps.length === 0 ||
            steps.length > 8 ||
            steps.some((s) => !Number.isInteger(s) || s < 1 || s > 60)
          ) {
            setError('Enter 1–8 whole numbers of days (1–60), separated by commas.');
            return;
          }
          setError(null);
          void onSave(steps);
        }}
      />
    </Field>
  );
}

export function QuranSettingsSection() {
  const settings = useSettings();
  const updateSettings = useApp((s) => s.updateSettings);
  const q = settings.quran;
  const save = async (patch: Partial<QuranSettingsT>) => {
    try {
      await updateSettings('quran', patch);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not save that setting.');
    }
  };
  const saveScheduler = (patch: Partial<Scheduler>) =>
    save({ scheduler: { ...q.scheduler, ...patch } });
  const s = q.scheduler;

  return (
    <div className="flex flex-col gap-6" data-goal="quran">
      <div className="grid grid-cols-2 gap-5">
        <NumberSetting
          label="Revision time per day"
          suffix="minutes"
          value={q.revisionMinutesPerDay}
          min={0}
          max={600}
          hint="Sizes the daily revision queue (Today’s chips override it for one day)."
          onSave={(v) => save({ revisionMinutesPerDay: v })}
        />
        <NumberSetting
          label="Minutes per page"
          suffix="minutes"
          step={0.5}
          value={q.minutesPerPage}
          min={0.5}
          max={30}
          hint="How long one page of revision takes you."
          onSave={(v) => save({ minutesPerPage: v })}
        />
        <NumberSetting
          label="New-learning time per day"
          suffix="minutes"
          value={q.newLearningMinutesPerDay}
          min={0}
          max={600}
          hint="Used by the planner when proposing your week."
          onSave={(v) => save({ newLearningMinutesPerDay: v })}
        />
        <NumberSetting
          label="Baseline pace"
          suffix="pages / week"
          step={0.5}
          value={q.baselinePagesPerWeek}
          min={0}
          max={60}
          hint="Fills the rolling 4-week pace until four weeks of data exist."
          onSave={(v) => save({ baselinePagesPerWeek: v })}
        />
        <NumberSetting
          label="On-track tolerance"
          suffix="pages"
          value={q.tolerancePages}
          min={0}
          max={60}
          hint="Within this many pages of the plan counts as on track."
          onSave={(v) => save({ tolerancePages: v })}
        />
        <Field
          label="Revision streak grace"
          htmlFor="quran-grace"
          hint="Missed days forgiven in any 7 days."
        >
          <Select
            id="quran-grace"
            className="w-[160px]"
            value={q.streakGraceDays}
            onChange={(e) => void save({ streakGraceDays: Number(e.target.value) })}
          >
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'None' : `${n} day${n === 1 ? '' : 's'}`}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="New pages continue">
        <SegmentedControl
          label="Direction of memorisation"
          value={q.direction}
          onChange={(direction) => void save({ direction })}
          options={[
            { value: 'backward', label: 'Backward (towards juz 1)' },
            { value: 'forward', label: 'Forward (towards juz 30)' },
          ]}
        />
      </Field>

      <details className="rounded-lg border border-rule px-4 py-3">
        <summary className="cursor-default text-[13.5px] font-medium text-ink">
          Revision scheduler
        </summary>
        <div className="mt-4 flex flex-col gap-5">
          <pre className="selectable overflow-x-auto rounded-lg bg-sunken p-4 font-mono text-[11.5px] leading-relaxed text-ink-muted">
            {`Recently learned pages: revise after each learning step, then join the rotation.
Memorised pages, rated after each revision:
  solid      next interval = min(${s.maxInterval}, max(interval, days since last × ease))
             ease + ${s.easeBonus}
  shaky      next interval = max(1, interval × ${s.shakyMultiplier}),  ease − ${s.shakyPenalty}
  forgotten  relearn over [${s.relearnSteps.join(', ')}] days,  ease − ${s.forgottenPenalty}
             then resume at max(${s.lapseMinInterval}, interval × ${s.lapseMultiplier})
Ease stays within ${s.easeMin}–${s.easeMax}; new pages start at ${s.initialEase}.
Retention estimate  R = 0.9 ^ (days since last revision ÷ interval)   (90% when due)
Due dates move up to ±${Math.round(s.loadBalanceFraction * 100)}% to the quietest nearby day.`}
          </pre>
          {/* Keyed by the stored values so the inputs reset when defaults are restored. */}
          <div key={JSON.stringify(s)} className="grid grid-cols-2 gap-5">
            <StepsSetting
              label="Learning steps"
              hint="Days between revisions of a newly learned page."
              value={s.learningSteps}
              onSave={(learningSteps) => saveScheduler({ learningSteps })}
            />
            <StepsSetting
              label="Relearning steps"
              hint="Days between revisions after a page is forgotten."
              value={s.relearnSteps}
              onSave={(relearnSteps) => saveScheduler({ relearnSteps })}
            />
            <NumberSetting
              label="Graduating interval"
              suffix="days"
              value={s.graduatingInterval}
              min={1}
              max={120}
              onSave={(v) => saveScheduler({ graduatingInterval: v })}
            />
            <NumberSetting
              label="Maximum interval"
              suffix="days"
              value={s.maxInterval}
              min={3}
              max={180}
              hint="Every page is revised at least this often."
              onSave={(v) => saveScheduler({ maxInterval: v })}
            />
            <NumberSetting
              label="Starting ease"
              step={0.05}
              value={s.initialEase}
              min={1.1}
              max={4}
              onSave={(v) => saveScheduler({ initialEase: v })}
            />
            <NumberSetting
              label="Ease bonus (solid)"
              step={0.01}
              value={s.easeBonus}
              min={0}
              max={0.5}
              onSave={(v) => saveScheduler({ easeBonus: v })}
            />
            <NumberSetting
              label="Ease penalty (shaky)"
              step={0.01}
              value={s.shakyPenalty}
              min={0}
              max={1}
              onSave={(v) => saveScheduler({ shakyPenalty: v })}
            />
            <NumberSetting
              label="Ease penalty (forgotten)"
              step={0.01}
              value={s.forgottenPenalty}
              min={0}
              max={1.5}
              onSave={(v) => saveScheduler({ forgottenPenalty: v })}
            />
            <NumberSetting
              label="Shaky interval multiplier"
              step={0.05}
              value={s.shakyMultiplier}
              min={0.1}
              max={1}
              onSave={(v) => saveScheduler({ shakyMultiplier: v })}
            />
            <NumberSetting
              label="Lapse interval multiplier"
              step={0.05}
              value={s.lapseMultiplier}
              min={0.05}
              max={1}
              onSave={(v) => saveScheduler({ lapseMultiplier: v })}
            />
            <NumberSetting
              label="Minimum interval after a lapse"
              suffix="days"
              value={s.lapseMinInterval}
              min={1}
              max={60}
              onSave={(v) => saveScheduler({ lapseMinInterval: v })}
            />
            <NumberSetting
              label="Load balancing"
              step={0.01}
              value={s.loadBalanceFraction}
              min={0}
              max={0.3}
              hint="Fraction of the interval a due date may move."
              onSave={(v) => saveScheduler({ loadBalanceFraction: v })}
            />
            <NumberSetting
              label="Ease floor"
              step={0.05}
              value={s.easeMin}
              min={1.05}
              max={3}
              onSave={(v) => saveScheduler({ easeMin: v })}
            />
            <NumberSetting
              label="Ease ceiling"
              step={0.05}
              value={s.easeMax}
              min={1.2}
              max={5}
              onSave={(v) => saveScheduler({ easeMax: v })}
            />
          </div>
          <div>
            <Button
              size="sm"
              onClick={() => {
                void save({ scheduler: { ...DEFAULT_SCHEDULER } }).then(() => {
                  toast.info('Scheduler restored to its defaults.');
                });
              }}
            >
              Restore scheduler defaults
            </Button>
            <p className="mt-2 text-[12px] text-ink-faint">
              Changes apply to future revisions; existing due dates are not rewritten.
            </p>
          </div>
        </div>
      </details>

      <JuzBoundaries value={q.juzStartPages} onSave={(juzStartPages) => save({ juzStartPages })} />
    </div>
  );
}

function JuzBoundaries({
  value,
  onSave,
}: {
  value: number[];
  onSave: (v: number[]) => Promise<void>;
}) {
  const [text, setText] = useState(value.join(', '));
  const [error, setError] = useState<string | null>(null);
  return (
    <details className="rounded-lg border border-rule px-4 py-3">
      <summary className="cursor-default text-[13.5px] font-medium text-ink">Mushaf layout</summary>
      <p className="mt-3 text-[12.5px] text-ink-muted">
        The first page of each of the 30 juz in a 604-page mushaf. The default is the common 15-line
        Madani print; adjust it if your copy differs. Only page numbers are stored.
      </p>
      <Field label="Juz start pages" htmlFor="juz-starts" error={error} className="mt-3">
        <TextArea
          id="juz-starts"
          className="font-mono text-[12px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            const starts = text
              .split(/[,\s]+/)
              .filter(Boolean)
              .map(Number);
            const problem = validateJuzStarts(starts);
            setError(problem);
            if (!problem) void onSave(starts).then(() => toast.success('Mushaf layout saved.'));
          }}
        >
          Save layout
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setText(MADANI_JUZ_START_PAGES.join(', '));
            setError(null);
            void onSave([...MADANI_JUZ_START_PAGES]);
          }}
        >
          Reset to Madani
        </Button>
      </div>
    </details>
  );
}
