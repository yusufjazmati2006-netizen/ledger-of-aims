import { useState } from 'react';
import { isClockTime } from '@shared/domain/time/clockTime';
import type { DegreeSettings, PlannerSettings } from '@shared/schemas/settings';
import { useApp, useSettings } from '../../stores/app';
import { toast } from '../../stores/toasts';
import { ApiError } from '../../lib/api';
import { Field, TextInput } from '../../design/Field';
import { Note } from '../../design/Card';
import { NumberField } from './NumberField';

function useSaver<K extends 'degree' | 'planner'>(namespace: K) {
  const updateSettings = useApp((s) => s.updateSettings);
  return async (patch: Partial<K extends 'degree' ? DegreeSettings : PlannerSettings>) => {
    try {
      await updateSettings(namespace, patch as never);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not save that setting.');
    }
  };
}

export function DegreeSettingsSection() {
  const d = useSettings().degree;
  const save = useSaver('degree');
  return (
    <div className="flex flex-col gap-5" data-goal="degree">
      <Note icon="alert" tone="warning">
        Defaults follow a common UK convention (Level 5 : Level 6 = 1 : 2, Level 4 not counted).
        Arden&apos;s actual rules were not available offline — please check the academic regulations
        and set them here.
      </Note>
      <div className="grid grid-cols-3 gap-5">
        {([4, 5, 6] as const).map((level) => (
          <NumberField
            key={level}
            id={`deg-l${level}`}
            label={`Level ${level} weight`}
            hint={level === 4 ? '0 = does not count' : undefined}
            integer={false}
            value={d.levelWeights[level]}
            min={0}
            max={10}
            onSave={(v) => save({ levelWeights: { ...d.levelWeights, [level]: v } })}
          />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-5">
        {(
          [
            ['first', 'First'],
            ['upperSecond', '2:1'],
            ['lowerSecond', '2:2'],
            ['third', 'Third'],
          ] as const
        ).map(([key, label]) => (
          <NumberField
            key={key}
            id={`deg-${key}`}
            label={`${label} from`}
            suffix="%"
            integer={false}
            value={d.boundaries[key]}
            min={0}
            max={100}
            onSave={(v) => save({ boundaries: { ...d.boundaries, [key]: v } })}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-5">
        <NumberField
          id="deg-credits"
          label="Credits per level"
          value={d.creditsPerLevel}
          min={20}
          max={240}
          onSave={(v) => save({ creditsPerLevel: v })}
        />
        <NumberField
          id="deg-hours"
          label="Study target"
          suffix="h / week"
          integer={false}
          value={d.studyHoursPerWeek}
          min={0}
          max={60}
          onSave={(v) => save({ studyHoursPerWeek: v })}
        />
        <NumberField
          id="deg-session"
          label="Session length"
          suffix="min"
          value={d.sessionMinutes}
          min={15}
          max={240}
          onSave={(v) => save({ sessionMinutes: v })}
        />
      </div>
    </div>
  );
}

function TimeField({
  id,
  label,
  value,
  onSave,
}: {
  id: string;
  label: string;
  value: string;
  onSave: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | null>(null);
  return (
    <Field label={label} error={error} htmlFor={id}>
      <TextInput
        id={id}
        type="time"
        className="w-[120px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (!isClockTime(text)) {
            setError('Use a 24-hour time.');
            return;
          }
          setError(null);
          if (text !== value) onSave(text);
        }}
      />
    </Field>
  );
}

export function PlannerSettingsSection() {
  const p = useSettings().planner;
  const save = useSaver('planner');
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[12.5px] text-ink-muted">
        After a night shift nothing is planned until you have had your sleep and morning routine;
        before a morning shift the evening ends in time for a full night. These numbers define that.
      </p>
      <div className="grid grid-cols-3 gap-5">
        <NumberField
          id="pl-sleep"
          label="Sleep"
          suffix="hours"
          integer={false}
          value={p.sleepHours}
          min={4}
          max={12}
          onSave={(v) => save({ sleepHours: v })}
        />
        <NumberField
          id="pl-commute"
          label="Commute (each way)"
          suffix="min"
          value={p.commuteMinutes}
          min={0}
          max={180}
          onSave={(v) => save({ commuteMinutes: v })}
        />
        <NumberField
          id="pl-recovery"
          label="Recovery after a shift"
          suffix="min"
          value={p.postShiftRecoveryMinutes}
          min={0}
          max={180}
          onSave={(v) => save({ postShiftRecoveryMinutes: v })}
        />
        <NumberField
          id="pl-wind"
          label="Wind-down before sleep"
          suffix="min"
          value={p.windDownMinutes}
          min={0}
          max={120}
          onSave={(v) => save({ windDownMinutes: v })}
        />
        <NumberField
          id="pl-routine"
          label="Morning routine"
          suffix="min"
          value={p.morningRoutineMinutes}
          min={0}
          max={120}
          onSave={(v) => save({ morningRoutineMinutes: v })}
        />
        <NumberField
          id="pl-min"
          label="Shortest useful window"
          suffix="min"
          value={p.minWindowMinutes}
          min={5}
          max={120}
          onSave={(v) => save({ minWindowMinutes: v })}
        />
        <TimeField
          id="pl-start"
          label="Day starts (days off)"
          value={p.dayStart}
          onSave={(v) => void save({ dayStart: v })}
        />
        <TimeField
          id="pl-end"
          label="Plans end by"
          value={p.dayEnd}
          onSave={(v) => void save({ dayEnd: v })}
        />
        <NumberField
          id="pl-clopen"
          label="Warn below sleep between shifts"
          suffix="hours"
          integer={false}
          value={p.minSleepBetweenShiftsHours}
          min={4}
          max={10}
          onSave={(v) => save({ minSleepBetweenShiftsHours: v })}
        />
      </div>
    </div>
  );
}
