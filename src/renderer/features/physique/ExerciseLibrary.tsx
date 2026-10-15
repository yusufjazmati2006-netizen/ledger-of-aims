import { useState, type SyntheticEvent } from 'react';
import type { Exercise } from '@shared/schemas/physique';
import { api, ApiError } from '../../lib/api';
import { toast } from '../../stores/toasts';
import { Card, Pill, SectionTitle } from '../../design/Card';
import { Button, IconButton } from '../../design/Button';
import { Dialog } from '../../design/Dialog';
import { LabeledInput, Switch } from '../../design/Field';
import { parseDecimal } from '../../lib/units';

/** The exercise library: what is in the every-other-day programme, and the rest. */
export function ExerciseLibrary({ exercises }: { exercises: Exercise[] }) {
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const visible = exercises.filter((e) => showArchived || !e.archived);

  const toggleProgram = (e: Exercise) =>
    void api('exercises.update', { id: e.id, patch: { inProgram: !e.inProgram } }).catch(() =>
      toast.error('Could not update the programme.'),
    );

  return (
    <section aria-labelledby="library">
      <SectionTitle
        id="library"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? 'Hide archived' : 'Show archived'}
            </Button>
            <Button size="sm" icon="plus" onClick={() => setEditing('new')}>
              New exercise
            </Button>
          </div>
        }
      >
        Exercise library
      </SectionTitle>
      <Card as="div">
        <ul>
          {visible.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-3 border-b border-rule px-5 py-2.5 last:border-0"
            >
              <button
                type="button"
                role="switch"
                aria-checked={e.inProgram}
                aria-label={`${e.name} in programme`}
                onClick={() => toggleProgram(e)}
                className={`h-[18px] w-[18px] shrink-0 rounded border-2 ${e.inProgram ? 'border-accent bg-accent' : 'border-control'}`}
              />
              <span
                className={`flex-1 text-[13.5px] ${e.archived ? 'text-ink-faint line-through' : 'text-ink'}`}
              >
                {e.name}
                <span className="ml-2 text-[12px] text-ink-faint">{e.muscleGroup}</span>
              </span>
              {e.bodyweight ? <Pill>bodyweight</Pill> : null}
              <span className="tabular w-36 text-right text-[12.5px] text-ink-muted">
                {e.setsTarget} × {e.repMin}–{e.repMax}
              </span>
              <IconButton
                icon="edit"
                size="sm"
                label={`Edit ${e.name}`}
                onClick={() => setEditing(e)}
              />
            </li>
          ))}
        </ul>
      </Card>
      <p className="mt-2 text-[12px] text-ink-faint">
        Ticked exercises make up your full-body session. Archive rather than delete to keep history.
      </p>
      {editing ? (
        <ExerciseDialog
          exercise={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}

function ExerciseDialog({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  const [name, setName] = useState(exercise?.name ?? '');
  const [group, setGroup] = useState(exercise?.muscleGroup ?? '');
  const [repMin, setRepMin] = useState(String(exercise?.repMin ?? 6));
  const [repMax, setRepMax] = useState(String(exercise?.repMax ?? 10));
  const [sets, setSets] = useState(String(exercise?.setsTarget ?? 3));
  const [increment, setIncrement] = useState(String(exercise?.incrementKg ?? 2.5));
  const [bodyweight, setBodyweight] = useState(exercise?.bodyweight ?? false);
  const [inProgram, setInProgram] = useState(exercise?.inProgram ?? true);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    const body = {
      name: name.trim(),
      muscleGroup: group.trim(),
      repMin: Number(repMin),
      repMax: Number(repMax),
      setsTarget: Number(sets),
      incrementKg: parseDecimal(increment) ?? -1,
      bodyweight,
      inProgram,
    };
    if (!body.name) {
      setError('Give the exercise a name.');
      return;
    }
    if (
      ![body.repMin, body.repMax, body.setsTarget].every(Number.isInteger) ||
      body.incrementKg < 0
    ) {
      setError('Check the numbers: whole reps and sets, and a load increment of 0 or more.');
      return;
    }
    try {
      if (exercise) await api('exercises.update', { id: exercise.id, patch: body });
      else await api('exercises.create', body);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the exercise.');
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      goal="physique"
      title={exercise ? `Edit ${exercise.name}` : 'New exercise'}
      footer={
        <>
          {exercise ? (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => {
                void api('exercises.update', {
                  id: exercise.id,
                  patch: { archived: !exercise.archived },
                }).then(onClose);
              }}
            >
              {exercise.archived ? 'Restore' : 'Archive'}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" type="submit" form="exercise-form">
            Save
          </Button>
        </>
      }
    >
      <form id="exercise-form" onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <div className="grid grid-cols-[1fr_160px] gap-3">
          <LabeledInput
            label="Name"
            value={name}
            autoFocus
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
          <LabeledInput
            label="Muscle group"
            value={group}
            maxLength={40}
            onChange={(e) => setGroup(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-4 gap-3">
          <LabeledInput
            label="Reps from"
            inputMode="numeric"
            value={repMin}
            onChange={(e) => setRepMin(e.target.value)}
          />
          <LabeledInput
            label="Reps to"
            inputMode="numeric"
            value={repMax}
            onChange={(e) => setRepMax(e.target.value)}
          />
          <LabeledInput
            label="Sets"
            inputMode="numeric"
            value={sets}
            onChange={(e) => setSets(e.target.value)}
          />
          <LabeledInput
            label="Increment"
            suffix="kg"
            inputMode="decimal"
            value={increment}
            onChange={(e) => setIncrement(e.target.value)}
          />
        </div>
        <Switch
          label="Bodyweight exercise"
          description="The load you log is added weight (0 for bodyweight only)."
          checked={bodyweight}
          onChange={setBodyweight}
        />
        <Switch label="In my full-body programme" checked={inProgram} onChange={setInProgram} />
        {error ? (
          <p role="alert" className="text-[12.5px] text-critical">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
