import { useState } from 'react';
import {
  dayTotals,
  formatQuantity,
  shoppingList,
  type PlanFood,
} from '@shared/domain/physique/mealPlan';
import { addDays, formatDate, startOfWeek, weekdayShort } from '@shared/domain/time/localDate';
import type { MealSlot } from '@shared/schemas/physique';
import { useSettings, useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { api } from '../../lib/api';
import { toast } from '../../stores/toasts';
import { cx } from '../../lib/cx';
import { Card, EmptyState, SectionTitle } from '../../design/Card';
import { Button, IconButton } from '../../design/Button';
import { SegmentedControl, TextInput } from '../../design/Field';
import { usePhysique } from './usePhysique';

const SLOTS: { id: MealSlot; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snacks' },
];

/**
 * Meal prep: plan the week from your favourites, see each day's totals against
 * target, batch-cook from one shopping list, and log a planned day in one click.
 */
export function MealPrepPage() {
  const today = useToday();
  const settings = useSettings();
  const physique = usePhysique();
  const [week, setWeek] = useState<'this' | 'next'>('this');
  const start = addDays(startOfWeek(today, settings.general.weekStartsOn), week === 'next' ? 7 : 0);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const end = days[6] ?? start;
  const foods = useLedger('foods.list', undefined, { domains: ['nutrition'] });
  const plan = useLedger('mealPlan.list', { from: start, to: end }, { domains: ['nutrition'] });
  const prep = useLedger('prep.list', { from: start, to: end }, { domains: ['nutrition'] });

  const foodMap = new Map<string, PlanFood>((foods.data ?? []).map((f) => [f.id, f]));
  const entries = plan.data ?? [];
  const totals = dayTotals(entries, foodMap);
  const list = shoppingList(entries, foodMap);
  const targets = physique.nutrition;
  const choices = (foods.data ?? []).filter((f) => !f.archived);

  const add = (date: string, slot: MealSlot, foodId: string) =>
    void api('mealPlan.add', { date, slot, foodId, servings: 1 }).catch(() =>
      toast.error('Could not add to the plan.'),
    );

  const copyFirstDay = () => {
    const first = days[0];
    if (!first) return;
    void api('mealPlan.copyDay', { from: first, to: days.slice(1) }).then(() =>
      toast.success(`Copied ${weekdayShort(first)}’s plan to the rest of the week.`),
    );
  };

  const logToday = async () => {
    const logged = await api('mealPlan.logDay', { date: today });
    if (logged.length === 0) toast.info('Nothing is planned for today.');
    else
      toast.success(
        `Logged ${logged.length} planned item${logged.length === 1 ? '' : 's'} as eaten today.`,
      );
  };

  const copyList = async () => {
    const text = list
      .map((i) => `• ${i.name}${formatQuantity(i) ? ` — ${formatQuantity(i)}` : ''}`)
      .join('\n');
    await navigator.clipboard.writeText(`Shopping list (week of ${formatDate(start)})\n${text}`);
    toast.success('Shopping list copied.');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Week"
          value={week}
          onChange={setWeek}
          options={[
            { value: 'this', label: 'This week' },
            { value: 'next', label: 'Next week' },
          ]}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={copyFirstDay}
            disabled={entries.every((e) => e.date !== days[0])}
          >
            Copy {days[0] ? weekdayShort(days[0]) : ''} to the rest of the week
          </Button>
          {week === 'this' ? (
            <Button size="sm" variant="accent" onClick={() => void logToday()}>
              Log today’s plan as eaten
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[860px] table-fixed text-[12.5px]">
          <caption className="sr-only">Meal plan for the week of {formatDate(start)}</caption>
          <thead>
            <tr className="border-b border-rule">
              <th scope="col" className="w-[92px]" />
              {days.map((d) => (
                <th
                  key={d}
                  scope="col"
                  className={cx(
                    'px-2 py-2.5 text-left font-medium',
                    d === today ? 'text-accent' : 'text-ink-muted',
                  )}
                >
                  {weekdayShort(d)} {Number(d.slice(8))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((slot) => (
              <tr key={slot.id} className="border-b border-rule align-top">
                <th scope="row" className="px-3 py-2 text-left font-medium text-ink-muted">
                  {slot.label}
                </th>
                {days.map((d) => (
                  <td key={d} className="px-1.5 py-1.5">
                    <div className="flex flex-col gap-1">
                      {entries
                        .filter((e) => e.date === d && e.slot === slot.id)
                        .map((e) => (
                          <span
                            key={e.id}
                            className="group flex items-center gap-1 rounded-md bg-accent-soft px-1.5 py-1 text-ink"
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {foodMap.get(e.foodId)?.name ?? 'Removed food'}
                            </span>
                            <IconButton
                              icon="close"
                              size="sm"
                              label={`Remove ${foodMap.get(e.foodId)?.name ?? 'item'} from ${slot.label.toLowerCase()} on ${formatDate(d)}`}
                              className="h-4 w-4 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                              onClick={() => void api('mealPlan.remove', { id: e.id })}
                            />
                          </span>
                        ))}
                      <select
                        aria-label={`Add to ${slot.label.toLowerCase()} on ${formatDate(d)}`}
                        className="h-6 w-full rounded border border-dashed border-rule-strong bg-transparent px-1 text-[11.5px] text-ink-faint hover:border-control"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) add(d, slot.id, e.target.value);
                        }}
                      >
                        <option value="">+ add</option>
                        {choices.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" className="px-3 py-2.5 text-left font-medium text-ink-muted">
                Total
              </th>
              {days.map((d) => {
                const t = totals.get(d);
                const close =
                  t && targets
                    ? Math.abs(t.calories - targets.calories) / targets.calories <= 0.1
                    : false;
                return (
                  <td key={d} className="tabular px-2 py-2.5">
                    {t ? (
                      <>
                        <div className={cx('font-semibold', close ? 'text-positive' : 'text-ink')}>
                          {Math.round(t.calories).toLocaleString('en-GB')} kcal{close ? ' ✓' : ''}
                        </div>
                        <div className="text-ink-faint">{Math.round(t.protein)} g protein</div>
                      </>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </Card>
      {targets ? (
        <p className="-mt-3 text-[12px] text-ink-faint">
          Target {targets.calories.toLocaleString('en-GB')} kcal and {targets.protein} g protein a
          day; ✓ marks a day planned within 10%.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="shopping">
          <SectionTitle
            id="shopping"
            action={
              list.length > 0 ? (
                <Button size="sm" variant="ghost" onClick={() => void copyList()}>
                  Copy list
                </Button>
              ) : null
            }
          >
            Shopping list
          </SectionTitle>
          {list.length === 0 ? (
            <EmptyState icon="layers" title="Plan a few meals first">
              The list adds up the ingredients of every planned serving this week — “200 g chicken”
              five times becomes 1 kg.
            </EmptyState>
          ) : (
            <Card as="div">
              <ul>
                {list.map((item) => (
                  <ShoppingRow
                    key={`${item.name}|${item.unit}`}
                    name={item.name}
                    quantity={formatQuantity(item)}
                  />
                ))}
              </ul>
            </Card>
          )}
        </section>
        <PrepSessions
          sessions={prep.data ?? []}
          defaultDate={days.find((d) => d >= today) ?? start}
        />
      </div>
    </div>
  );
}

function ShoppingRow({ name, quantity }: { name: string; quantity: string }) {
  const [got, setGot] = useState(false);
  return (
    <li className="border-b border-rule last:border-0">
      <label className="flex cursor-default items-center gap-3 px-5 py-2">
        <input
          type="checkbox"
          checked={got}
          onChange={(e) => setGot(e.target.checked)}
          className="h-4 w-4 accent-[var(--physique)]"
        />
        <span
          className={cx('flex-1 text-[13px]', got ? 'text-ink-faint line-through' : 'text-ink')}
        >
          {name}
        </span>
        <span className="tabular text-[12.5px] text-ink-muted">{quantity}</span>
      </label>
    </li>
  );
}

function PrepSessions({
  sessions,
  defaultDate,
}: {
  sessions: { id: string; date: string; notes: string; done: boolean }[];
  defaultDate: string;
}) {
  const [date, setDate] = useState(defaultDate);
  const [notes, setNotes] = useState('');
  return (
    <section aria-labelledby="prep">
      <SectionTitle id="prep">Prep sessions</SectionTitle>
      <Card as="div" className="p-4">
        {sessions.length === 0 ? (
          <p className="mb-3 text-[13px] text-ink-muted">
            Batch-cooking twice a week is the easiest way to hit your numbers on shift days.
            Schedule a session on a day off.
          </p>
        ) : (
          <ul className="mb-3 flex flex-col gap-1.5">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 text-[13px]">
                <input
                  type="checkbox"
                  aria-label={`Prep on ${formatDate(s.date)} done`}
                  checked={s.done}
                  onChange={(e) => void api('prep.save', { ...s, done: e.target.checked })}
                  className="h-4 w-4 accent-[var(--physique)]"
                />
                <span className="w-24 text-ink-muted">
                  {weekdayShort(s.date)} {formatDate(s.date, { year: false })}
                </span>
                <span className={cx('flex-1', s.done ? 'text-ink-faint line-through' : 'text-ink')}>
                  {s.notes || 'Prep session'}
                </span>
                <IconButton
                  icon="trash"
                  size="sm"
                  tone="danger"
                  label={`Delete prep on ${formatDate(s.date)}`}
                  onClick={() => void api('prep.delete', { id: s.id })}
                />
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void api('prep.save', { date, notes: notes.trim(), done: false }).then(() =>
              setNotes(''),
            );
          }}
        >
          <TextInput
            type="date"
            aria-label="Prep date"
            className="w-[150px]"
            value={date}
            onChange={(e) => setDate(e.target.value || defaultDate)}
          />
          <TextInput
            aria-label="What to prepare"
            placeholder="e.g. 5 × chicken & rice, overnight oats"
            className="w-[260px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button type="submit" size="sm">
            Schedule
          </Button>
        </form>
      </Card>
    </section>
  );
}
