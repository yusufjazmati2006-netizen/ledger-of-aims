import { useState, type SyntheticEvent } from 'react';
import { useSettings, useToday } from '../../stores/app';
import { api, ApiError } from '../../lib/api';
import { formatWeight, parseDecimal, unitToKg } from '../../lib/units';
import { toast } from '../../stores/toasts';
import { Button } from '../../design/Button';
import { TextInput } from '../../design/Field';
import type { WeighIn } from '@shared/schemas/core';

/**
 * Logs a weigh-in in one field and Enter. Logging again on the same day replaces
 * the earlier value; Undo restores whatever was there before.
 */
export function WeighInForm({
  existing,
  compact = false,
}: {
  existing: WeighIn[];
  compact?: boolean;
}) {
  const today = useToday();
  const settings = useSettings();
  const unit = settings.general.units;
  const [text, setText] = useState('');
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    const value = parseDecimal(text);
    const kg = value === null ? null : unitToKg(value, unit);
    if (kg === null || kg < 25 || kg > 350) {
      setError(
        unit === 'kg'
          ? 'Enter a weight between 25 and 350 kg.'
          : 'Enter a weight between 55 and 770 lb.',
      );
      return;
    }
    setError(null);
    const previous = existing.find((w) => w.date === date);
    try {
      const saved = await api('weighIns.upsert', { date, weightKg: kg });
      setText('');
      toast.success(
        `Logged ${formatWeight(saved.weightKg, unit)}${date === today ? '' : ` for ${date}`}.`,
        {
          label: 'Undo',
          run: () => {
            const undo = previous
              ? api('weighIns.upsert', {
                  date: previous.date,
                  weightKg: previous.weightKg,
                  note: previous.note,
                })
              : api('weighIns.delete', { id: saved.id });
            void undo.catch(() => toast.error('Could not undo.'));
          },
        },
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the weigh-in.');
    }
  };

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="flex flex-wrap items-start gap-2"
      aria-label="Log a weigh-in"
    >
      <div className="relative">
        <TextInput
          aria-label={`Weight in ${unit}`}
          aria-invalid={error ? true : undefined}
          inputMode="decimal"
          placeholder={unit === 'kg' ? 'e.g. 66.8' : 'e.g. 147.2'}
          className="w-[140px] pr-9"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12.5px] text-ink-faint">
          {unit}
        </span>
      </div>
      {compact ? null : (
        <TextInput
          aria-label="Date of weigh-in"
          type="date"
          className="w-[150px]"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value || today)}
        />
      )}
      <Button type="submit" variant="accent">
        Log weight
      </Button>
      {error ? (
        <p role="alert" className="basis-full text-[12px] text-critical">
          {error}
        </p>
      ) : null}
    </form>
  );
}
