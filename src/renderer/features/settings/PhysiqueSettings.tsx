import { useState } from 'react';
import type { PhysiqueSettings as PhysiqueSettingsT } from '@shared/schemas/settings';
import { useApp, useSettings } from '../../stores/app';
import { toast } from '../../stores/toasts';
import { ApiError } from '../../lib/api';
import { parseDecimal } from '../../lib/units';
import { Field, SegmentedControl, Select, TextInput } from '../../design/Field';

/** A nullable numeric setting: empty means "not set". */
function OptionalNumber({
  id,
  label,
  hint,
  value,
  min,
  max,
  suffix,
  integer = true,
  onSave,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number | null;
  min: number;
  max: number;
  suffix?: string;
  integer?: boolean;
  onSave: (v: number | null) => Promise<void>;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const [error, setError] = useState<string | null>(null);
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <div className="flex items-center gap-2">
        <TextInput
          id={id}
          inputMode="decimal"
          className="w-[110px]"
          value={text}
          placeholder="—"
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text.trim() === '') {
              setError(null);
              if (value !== null) void onSave(null);
              return;
            }
            const n = parseDecimal(text);
            if (n === null || n < min || n > max || (integer && !Number.isInteger(n))) {
              setError(
                `Enter ${integer ? 'a whole number' : 'a number'} from ${min} to ${max}, or leave empty.`,
              );
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

export function PhysiqueSettingsSection() {
  const settings = useSettings();
  const updateSettings = useApp((s) => s.updateSettings);
  const p = settings.physique;
  const save = async (patch: Partial<PhysiqueSettingsT>) => {
    try {
      await updateSettings('physique', patch);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not save that setting.');
    }
  };
  // Required numeric settings: an emptied field leaves the value unchanged.
  const num = (key: keyof PhysiqueSettingsT) => async (v: number | null) => {
    if (v !== null) await save({ [key]: v });
  };

  return (
    <div className="flex flex-col gap-6" data-goal="physique">
      <p className="text-[12.5px] text-ink-muted">
        Height, birth year and sex let calorie targets use the Mifflin–St Jeor equation; without
        them a bodyweight estimate is used. These stay on this Mac.
      </p>
      <div className="grid grid-cols-3 gap-5">
        <OptionalNumber
          id="ph-height"
          label="Height"
          suffix="cm"
          value={p.heightCm}
          min={100}
          max={250}
          onSave={(v) => save({ heightCm: v })}
        />
        <OptionalNumber
          id="ph-birth"
          label="Birth year"
          value={p.birthYear}
          min={1900}
          max={2020}
          onSave={(v) => save({ birthYear: v })}
        />
        <Field label="Sex (for the equation)">
          <SegmentedControl
            size="sm"
            label="Sex"
            value={p.sex ?? 'unset'}
            onChange={(v) => void save({ sex: v === 'unset' ? null : v })}
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'unset', label: 'Not set' },
            ]}
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-5">
        <Field
          label="Activity"
          htmlFor="ph-activity"
          hint="Cafe shifts plus training sit around “moderate”."
        >
          <Select
            id="ph-activity"
            value={p.activityFactor}
            onChange={(e) => void save({ activityFactor: Number(e.target.value) })}
          >
            {[
              [1.2, 'Sedentary (1.2)'],
              [1.375, 'Light (1.375)'],
              [1.55, 'Moderate (1.55)'],
              [1.725, 'Very active (1.725)'],
              [1.9, 'Extremely active (1.9)'],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <OptionalNumber
          id="ph-surplus"
          label="Daily surplus"
          suffix="kcal"
          hint="150–300 suits a lean gain."
          value={p.surplusKcal}
          min={-1000}
          max={1500}
          onSave={num('surplusKcal')}
        />
        <OptionalNumber
          id="ph-protein"
          label="Protein"
          suffix="g / kg"
          integer={false}
          hint="1.6–2.2 g/kg is typical."
          value={p.proteinPerKg}
          min={0.8}
          max={3.5}
          onSave={num('proteinPerKg')}
        />
        <OptionalNumber
          id="ph-cal-override"
          label="Calorie target override"
          suffix="kcal"
          hint="Leave empty to use the formula."
          value={p.calorieOverride}
          min={800}
          max={8000}
          onSave={(v) => save({ calorieOverride: v })}
        />
        <OptionalNumber
          id="ph-protein-override"
          label="Protein target override"
          suffix="g"
          hint="Leave empty to use the formula."
          value={p.proteinOverride}
          min={20}
          max={500}
          onSave={(v) => save({ proteinOverride: v })}
        />
        <Field label="Rest days between sessions" htmlFor="ph-rest">
          <Select
            id="ph-rest"
            value={p.restDays}
            onChange={(e) => void save({ restDays: Number(e.target.value) })}
          >
            <option value={1}>1 (every other day)</option>
            <option value={2}>2</option>
            <option value={0}>0 (daily)</option>
          </Select>
        </Field>
      </div>
      <details className="rounded-lg border border-rule px-4 py-3">
        <summary className="cursor-default text-[13.5px] font-medium text-ink">
          Trend, rate warnings and streak
        </summary>
        <div className="mt-4 grid grid-cols-3 gap-5">
          <OptionalNumber
            id="ph-alpha"
            label="Trend smoothing (α)"
            integer={false}
            hint="Lower is smoother; 0.1 is classic."
            value={p.trendAlpha}
            min={0.02}
            max={0.5}
            onSave={num('trendAlpha')}
          />
          <OptionalNumber
            id="ph-fast"
            label="Too-fast margin"
            suffix="kg / week"
            integer={false}
            hint="Above the plan's rate by this much."
            value={p.fastMarginKg}
            min={0}
            max={1}
            onSave={num('fastMarginKg')}
          />
          <OptionalNumber
            id="ph-slow"
            label="Too-slow margin"
            suffix="kg / week"
            integer={false}
            hint="Below the plan's rate by this much."
            value={p.slowMarginKg}
            min={0}
            max={1}
            onSave={num('slowMarginKg')}
          />
          <OptionalNumber
            id="ph-max"
            label="Gain ceiling"
            suffix="% / week"
            integer={false}
            hint="Of bodyweight; above this is likely fat."
            value={p.maxWeeklyGainPct}
            min={0.1}
            max={2}
            onSave={num('maxWeeklyGainPct')}
          />
          <OptionalNumber
            id="ph-threshold"
            label="Adherence for the streak"
            suffix="/ 100"
            value={p.adherenceThreshold}
            min={40}
            max={100}
            onSave={num('adherenceThreshold')}
          />
          <Field
            label="Nutrition streak grace"
            htmlFor="ph-grace"
            hint="Missed days forgiven in any 7 days."
          >
            <Select
              id="ph-grace"
              value={p.streakGraceDays}
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
      </details>
    </div>
  );
}
