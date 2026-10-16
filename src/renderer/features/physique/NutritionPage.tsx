import { useMemo, useState, type SyntheticEvent } from 'react';
import { adherenceScore, sumIntake } from '@shared/domain/physique/nutrition';
import { computeStreak } from '@shared/domain/streaks/streaks';
import { addDays, formatDate, formatDateLong, weekdayShort } from '@shared/domain/time/localDate';
import type { Food, FoodEntry } from '@shared/schemas/physique';
import { useSettings, useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { api, ApiError } from '../../lib/api';
import { parseDecimal } from '../../lib/units';
import { toast } from '../../stores/toasts';
import { Card, Note, Pill, SectionTitle } from '../../design/Card';
import { Button, IconButton } from '../../design/Button';
import { Dialog } from '../../design/Dialog';
import { Field, LabeledInput, Switch, TextArea, TextInput } from '../../design/Field';
import { Meter } from '../../design/Ring';
import { BarChartCard } from '../../design/charts/BarChartCard';
import { useTokenColors } from '../../design/charts/colors';
import { usePhysique } from './usePhysique';

const round = (v: number) => Math.round(v);

export function NutritionPage() {
  const today = useToday();
  const settings = useSettings();
  const physique = usePhysique();
  const colors = useTokenColors(['physique'] as const);
  const [date, setDate] = useState(today);
  const [editingFood, setEditingFood] = useState<Food | 'new' | null>(null);
  const foods = useLedger('foods.list', undefined, { domains: ['nutrition'] });
  const history = useLedger(
    'foodEntries.list',
    { from: addDays(today, -60), to: today },
    { domains: ['nutrition'] },
  );
  const dayEntries = useLedger(
    'foodEntries.list',
    { from: date, to: date },
    { domains: ['nutrition'] },
  );
  const targets = physique.nutrition;

  const intake = sumIntake(dayEntries.data ?? []);
  const score = targets ? adherenceScore(intake, targets) : 0;

  // Daily scores for the streak and chart, using today's targets (they move slowly).
  const daily = useMemo(() => {
    const byDay = new Map<string, FoodEntry[]>();
    for (const e of history.data ?? []) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
    return Array.from({ length: 60 }, (_, i) => addDays(today, -59 + i)).map((d) => {
      const entries = byDay.get(d) ?? [];
      return {
        date: d,
        logged: entries.length > 0,
        score: targets && entries.length ? adherenceScore(sumIntake(entries), targets) : 0,
      };
    });
  }, [history.data, targets, today]);
  const streak = computeStreak(
    daily.filter((d) => d.score >= settings.physique.adherenceThreshold).map((d) => d.date),
    today,
    { graceDays: settings.physique.streakGraceDays, windowDays: 7 },
  );
  const favourites = (foods.data ?? []).filter((f) => f.favourite && !f.archived);

  const quickAdd = async (food: Food) => {
    try {
      const entry = await api('foodEntries.log', { date, foodId: food.id, servings: 1 });
      toast.success(`Added ${food.name}.`, {
        label: 'Undo',
        run: () => void api('foodEntries.delete', { id: entry.id }),
      });
    } catch {
      toast.error('Could not add that food.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <IconButton
            icon="chevronLeft"
            label="Previous day"
            onClick={() => setDate(addDays(date, -1))}
          />
          <h2
            className="min-w-[230px] text-center font-serif text-[19px] font-semibold"
            aria-live="polite"
          >
            {date === today ? 'Today' : formatDateLong(date)}
          </h2>
          <IconButton
            icon="chevronRight"
            label="Next day"
            disabled={date >= today}
            onClick={() => setDate(addDays(date, 1))}
          />
        </div>
        <Pill tone={score >= settings.physique.adherenceThreshold ? 'positive' : 'neutral'}>
          Adherence {score}/100
        </Pill>
      </div>

      <Card className="p-6">
        {targets ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_1fr_220px]">
            <IntakeMeter
              label="Calories"
              value={intake.calories}
              target={targets.calories}
              unit="kcal"
            />
            <IntakeMeter label="Protein" value={intake.protein} target={targets.protein} unit="g" />
            <div>
              <div className="eyebrow">Nutrition streak</div>
              <div
                className="mt-1 text-[24px] font-semibold text-ink"
                data-testid="nutrition-streak"
              >
                {streak.length} day{streak.length === 1 ? '' : 's'}
              </div>
              <p className="mt-1 text-[12.5px] text-ink-muted">
                Days scoring {settings.physique.adherenceThreshold}+.{' '}
                {streak.atRisk
                  ? 'Today keeps it alive — your grace day is used.'
                  : `${streak.graceRemaining} grace day${streak.graceRemaining === 1 ? '' : 's'} left this week; one miss won’t reset it.`}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-ink-muted">Log a weigh-in to compute your targets.</p>
        )}
        {targets ? (
          <details className="mt-5 border-t border-rule pt-4">
            <summary className="cursor-default text-[12.5px] font-medium text-ink-muted">
              How {targets.calories.toLocaleString('en-GB')} kcal and {targets.protein} g were
              worked out
            </summary>
            <ul className="selectable mt-2 flex flex-col gap-1 font-mono text-[12px] text-ink-muted">
              {targets.formula.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-ink-faint">
              Uses your trend weight. Change the surplus, protein per kg, or your height, age and
              sex in Settings → Physique.
            </p>
          </details>
        ) : null}
      </Card>

      <section aria-labelledby="quick-add">
        <SectionTitle
          id="quick-add"
          action={
            <Button size="sm" variant="ghost" icon="plus" onClick={() => setEditingFood('new')}>
              New favourite
            </Button>
          }
        >
          Quick add
        </SectionTitle>
        <div className="flex flex-wrap gap-2">
          {favourites.map((f) => (
            <div
              key={f.id}
              className="group flex items-stretch overflow-hidden rounded-lg border border-rule bg-surface"
            >
              <button
                type="button"
                onClick={() => void quickAdd(f)}
                className="px-3 py-2 text-left transition-colors hover:bg-accent-soft"
              >
                <div className="text-[13px] font-medium text-ink">
                  <span className="sr-only">Add </span>
                  {f.name}
                </div>
                <div className="tabular text-[11.5px] text-ink-faint">
                  {round(f.calories)} kcal · {round(f.protein)} g
                  {f.serving ? ` · ${f.serving}` : ''}
                </div>
              </button>
              <IconButton
                icon="edit"
                size="sm"
                label={`Edit ${f.name}`}
                className="h-auto rounded-none opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => setEditingFood(f)}
              />
            </div>
          ))}
        </div>
        <CustomEntry date={date} />
      </section>

      <section aria-labelledby="entries">
        <SectionTitle id="entries">{date === today ? 'Eaten today' : 'Eaten'}</SectionTitle>
        {(dayEntries.data ?? []).length === 0 ? (
          <p className="text-[13px] text-ink-muted">
            Nothing logged yet. One tap on a favourite above is enough.
          </p>
        ) : (
          <Card as="div">
            <ul>
              {(dayEntries.data ?? []).map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 border-b border-rule px-5 py-2.5 last:border-0"
                >
                  <span className="flex-1 text-[13.5px] text-ink">
                    {e.name}
                    {e.servings !== 1 ? (
                      <span className="ml-1.5 text-ink-faint">× {e.servings}</span>
                    ) : null}
                  </span>
                  <span className="tabular w-24 text-right text-[12.5px] text-ink-muted">
                    {round(e.calories * e.servings)} kcal
                  </span>
                  <span className="tabular w-16 text-right text-[12.5px] text-ink-muted">
                    {round(e.protein * e.servings)} g
                  </span>
                  <IconButton
                    icon="trash"
                    size="sm"
                    tone="danger"
                    label={`Remove ${e.name}`}
                    onClick={() => void api('foodEntries.delete', { id: e.id })}
                  />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <Card className="p-6">
        <BarChartCard
          title="Adherence, last 14 days"
          summary={`Daily adherence scores; ${daily.slice(-14).filter((d) => d.score >= settings.physique.adherenceThreshold).length} of 14 days met the ${settings.physique.adherenceThreshold} threshold.`}
          rows={daily.slice(-14).map((d) => ({
            label: `${weekdayShort(d.date).slice(0, 2)} ${Number(d.date.slice(8))}`,
            detail: `${formatDate(d.date)}${d.logged ? '' : ' (nothing logged)'}`,
            value: d.score,
          }))}
          color={colors.physique}
          seriesLabel="Score"
          unit="/ 100"
          reference={{ value: settings.physique.adherenceThreshold, label: 'Streak threshold' }}
        />
      </Card>

      {editingFood ? (
        <FoodDialog
          food={editingFood === 'new' ? null : editingFood}
          onClose={() => setEditingFood(null)}
        />
      ) : null}
    </div>
  );
}

function IntakeMeter({
  label,
  value,
  target,
  unit,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
}) {
  const remaining = target - value;
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-[24px] font-semibold text-ink">
          {round(value).toLocaleString('en-GB')}
        </span>
        <span className="text-[13px] text-ink-muted">
          / {round(target).toLocaleString('en-GB')} {unit}
        </span>
      </div>
      {/* The bar runs to 110% of target so a small overshoot is still visible. */}
      <Meter
        value={value / Math.max(1, target * 1.1)}
        target={1 / 1.1}
        label={`${label}: ${round(value)} of ${round(target)} ${unit}`}
        className="mt-2"
      />
      <p className="mt-1.5 text-[12px] text-ink-faint">
        {remaining > 0
          ? `${round(remaining).toLocaleString('en-GB')} ${unit} to go`
          : `${round(-remaining).toLocaleString('en-GB')} ${unit} over`}
      </p>
    </div>
  );
}

function CustomEntry({ date }: { date: string }) {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    const calories = parseDecimal(kcal);
    const p = protein.trim() === '' ? 0 : parseDecimal(protein);
    if (!name.trim() || calories === null || p === null) {
      setError('Enter a name, calories and (optionally) protein.');
      return;
    }
    setError(null);
    try {
      await api('foodEntries.log', { date, name: name.trim(), calories, protein: p, servings: 1 });
      setName('');
      setKcal('');
      setProtein('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the entry.');
    }
  };
  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="mt-3 flex flex-wrap items-center gap-2"
      aria-label="Add something else"
    >
      <TextInput
        aria-label="Food name"
        placeholder="Something else…"
        className="w-[220px]"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextInput
        aria-label="Calories"
        placeholder="kcal"
        inputMode="decimal"
        className="w-[90px]"
        value={kcal}
        onChange={(e) => setKcal(e.target.value)}
      />
      <TextInput
        aria-label="Protein in grams"
        placeholder="protein g"
        inputMode="decimal"
        className="w-[100px]"
        value={protein}
        onChange={(e) => setProtein(e.target.value)}
      />
      <Button type="submit" size="sm">
        Add
      </Button>
      {error ? (
        <span role="alert" className="text-[12px] text-critical">
          {error}
        </span>
      ) : null}
    </form>
  );
}

export function FoodDialog({ food, onClose }: { food: Food | null; onClose: () => void }) {
  const [name, setName] = useState(food?.name ?? '');
  const [kcal, setKcal] = useState(food ? String(food.calories) : '');
  const [protein, setProtein] = useState(food ? String(food.protein) : '');
  const [serving, setServing] = useState(food?.serving ?? '');
  const [ingredients, setIngredients] = useState(food?.ingredients ?? '');
  const [favourite, setFavourite] = useState(food?.favourite ?? true);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    const calories = parseDecimal(kcal);
    const p = parseDecimal(protein);
    if (!name.trim() || calories === null || p === null) {
      setError('Name, calories and protein are required.');
      return;
    }
    const body = {
      name: name.trim(),
      calories,
      protein: p,
      serving: serving.trim(),
      ingredients: ingredients.trim(),
      favourite,
    };
    try {
      if (food) await api('foods.update', { id: food.id, patch: body });
      else await api('foods.create', body);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save.');
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      goal="physique"
      title={food ? `Edit ${food.name}` : 'New favourite'}
      description="Values are per serving. Ingredients (one per line, e.g. “200 g chicken breast”) feed the shopping list."
      footer={
        <>
          {food ? (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() =>
                void api('foods.update', { id: food.id, patch: { archived: true } }).then(onClose)
              }
            >
              Archive
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" type="submit" form="food-form">
            Save
          </Button>
        </>
      }
    >
      <form id="food-form" onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <LabeledInput
          label="Name"
          autoFocus
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid grid-cols-3 gap-3">
          <LabeledInput
            label="Calories"
            suffix="kcal"
            inputMode="decimal"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
          />
          <LabeledInput
            label="Protein"
            suffix="g"
            inputMode="decimal"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
          />
          <LabeledInput
            label="Serving"
            placeholder="1 box"
            value={serving}
            maxLength={40}
            onChange={(e) => setServing(e.target.value)}
          />
        </div>
        <Field label="Ingredients" htmlFor="food-ingredients">
          <TextArea
            id="food-ingredients"
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
          />
        </Field>
        <Switch label="Show in quick add" checked={favourite} onChange={setFavourite} />
        <Note>Starter favourites use typical values — check them against your own labels.</Note>
        {error ? (
          <p role="alert" className="text-[12.5px] text-critical">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
