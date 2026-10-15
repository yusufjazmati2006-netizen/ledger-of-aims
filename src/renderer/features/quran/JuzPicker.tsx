import { buildLayout } from '@shared/domain/quran/mushaf';
import type { Direction } from '@shared/domain/quran/progress';
import { SegmentedControl } from '../../design/Field';
import { cx } from '../../lib/cx';

const layout = buildLayout();

/**
 * Chooses which juz are already memorised and the direction memorisation continues
 * in. Used during onboarding and on the Quran screen until the mushaf is set up.
 */
export function JuzPicker({
  selected,
  onChange,
  direction,
  onDirectionChange,
}: {
  selected: number[];
  onChange: (juz: number[]) => void;
  direction: Direction;
  onDirectionChange: (direction: Direction) => void;
}) {
  const set = new Set(selected);
  const toggle = (juz: number) => {
    const next = new Set(set);
    if (next.has(juz)) next.delete(juz);
    else next.add(juz);
    onChange([...next].sort((a, b) => a - b));
  };
  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const pages = selected.reduce((n, j) => n + (layout.juz[j - 1]?.size ?? 0), 0);

  return (
    <div className="flex flex-col gap-5" data-goal="quran">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span id="juz-picker-label" className="text-[12.5px] font-medium text-ink-muted">
            Juz already memorised
          </span>
          <span className="tabular text-[12.5px] text-ink-muted" aria-live="polite">
            {selected.length} juz · {pages} pages
          </span>
        </div>
        <div role="group" aria-labelledby="juz-picker-label" className="grid grid-cols-10 gap-1.5">
          {range(1, 30).map((juz) => {
            const on = set.has(juz);
            return (
              <button
                key={juz}
                type="button"
                aria-pressed={on}
                aria-label={`Juz ${juz}`}
                onClick={() => {
                  toggle(juz);
                }}
                className={cx(
                  'tabular h-9 rounded-md border text-[13px] font-medium transition-colors duration-150',
                  on
                    ? 'border-accent bg-accent text-paper'
                    : 'border-rule-strong bg-surface text-ink-muted hover:border-accent hover:text-ink',
                )}
              >
                {juz}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[12.5px] text-ink-muted">
          <span>Quick select:</span>
          {[
            { label: 'Juz 1–15', juz: range(1, 15) },
            { label: 'Juz 16–30', juz: range(16, 30) },
            { label: 'Juz 30 only', juz: [30] },
            { label: 'None', juz: [] },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="font-medium text-ink underline-offset-2 hover:underline"
              onClick={() => {
                onChange(preset.juz);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-[12.5px] font-medium text-ink-muted">New pages continue</div>
        <SegmentedControl
          label="Direction of memorisation"
          value={direction}
          onChange={onDirectionChange}
          options={[
            { value: 'backward', label: 'Backward (towards juz 1)' },
            { value: 'forward', label: 'Forward (towards juz 30)' },
          ]}
        />
        <p className="mt-2 text-[12px] text-ink-faint">
          Backward memorisers take each juz from its first page, then move to the juz before it.
        </p>
      </div>
    </div>
  );
}
