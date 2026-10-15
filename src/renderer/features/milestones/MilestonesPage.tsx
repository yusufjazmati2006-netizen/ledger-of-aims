import { useState, type SyntheticEvent } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { countdown, milestonesFor } from '@shared/domain/milestones/milestones';
import { formatDate, isLocalDate } from '@shared/domain/time/localDate';
import { GOAL_IDS, type GoalId } from '@shared/schemas/common';
import type { Milestone, MilestoneKind } from '@shared/schemas/core';
import { useToday } from '../../stores/app';
import { useCelebration } from '../../stores/celebration';
import { toast } from '../../stores/toasts';
import { useLedger } from '../../lib/useLedger';
import { api, ApiError } from '../../lib/api';
import { GOAL_META } from '../../lib/goals';
import { cx } from '../../lib/cx';
import { Card, PageHeader, Pill } from '../../design/Card';
import { Button, IconButton } from '../../design/Button';
import { Dialog } from '../../design/Dialog';
import { Field, LabeledInput, SegmentedControl, TextArea } from '../../design/Field';
import { Icon } from '../../design/icons';
import { parseDecimal } from '../../lib/units';

type Editing = { mode: 'create'; goalId: GoalId } | { mode: 'edit'; milestone: Milestone } | null;

export function MilestonesPage() {
  const goals = useLedger('goals.list', undefined, { domains: ['goals'] });
  const milestones = useLedger('milestones.list', undefined, { domains: ['milestones'] });
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Milestone | null>(null);

  return (
    <div className="animate-fade-in pt-6">
      <PageHeader
        title="Milestones"
        description="Every dated checkpoint across your four aims. Drag to reorder (or focus the handle and use Space and the arrow keys); tick one off when it is done."
      />
      <div className="flex flex-col gap-6">
        {GOAL_IDS.map((goalId) => (
          <GoalMilestones
            key={goalId}
            goalId={goalId}
            title={goals.data?.find((g) => g.id === goalId)?.title ?? GOAL_META[goalId].short}
            items={milestonesFor(milestones.data ?? [], goalId)}
            onAdd={() => setEditing({ mode: 'create', goalId })}
            onEdit={(milestone) => setEditing({ mode: 'edit', milestone })}
            onDelete={setDeleting}
          />
        ))}
      </div>
      {editing ? <MilestoneDialog editing={editing} onClose={() => setEditing(null)} /> : null}
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this milestone?"
        description={
          deleting ? `“${deleting.title}” will be removed. This cannot be undone.` : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!deleting) return;
                void api('milestones.delete', { id: deleting.id })
                  .then(() => toast.info('Milestone deleted.'))
                  .catch(() => toast.error('Could not delete the milestone.'));
                setDeleting(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      />
    </div>
  );
}

function GoalMilestones({
  goalId,
  title,
  items,
  onAdd,
  onEdit,
  onDelete,
}: {
  goalId: GoalId;
  title: string;
  items: Milestone[];
  onAdd: () => void;
  onEdit: (m: Milestone) => void;
  onDelete: (m: Milestone) => void;
}) {
  const [order, setOrder] = useState<string[] | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // While a reorder is in flight, show the optimistic order.
  const ids = order ?? items.map((m) => m.id);
  const byId = new Map(items.map((m) => [m.id, m]));
  const ordered = ids.map((id) => byId.get(id)).filter((m): m is Milestone => m !== undefined);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    const next = arrayMove(ids, from, to);
    setOrder(next);
    void api('milestones.reorder', { goalId, orderedIds: next })
      .catch(() => toast.error('Could not save the new order.'))
      .finally(() => setOrder(null));
  };

  return (
    <Card data-goal={goalId} className="p-5" aria-labelledby={`ms-${goalId}`}>
      <div className="mb-3 flex items-center gap-2.5">
        <Icon name={GOAL_META[goalId].icon} className="text-accent" />
        <h2 id={`ms-${goalId}`} className="flex-1 font-serif text-[18px] font-semibold">
          {title}
        </h2>
        <Button size="sm" variant="ghost" icon="plus" onClick={onAdd}>
          Add milestone
        </Button>
      </div>
      {ordered.length === 0 ? (
        <p className="py-2 text-[13px] text-ink-muted">
          No milestones yet. Add the next checkpoint you are aiming for.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements: {
              onDragStart: ({ active }) =>
                `Picked up ${byId.get(String(active.id))?.title ?? 'milestone'}.`,
              onDragOver: ({ over }) =>
                over ? `Over position ${ids.indexOf(String(over.id)) + 1}.` : '',
              onDragEnd: ({ over }) =>
                over ? `Dropped at position ${ids.indexOf(String(over.id)) + 1}.` : 'Dropped.',
              onDragCancel: () => 'Reordering cancelled.',
            },
          }}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col">
              {ordered.map((m) => (
                <MilestoneRow
                  key={m.id}
                  milestone={m}
                  onEdit={() => onEdit(m)}
                  onDelete={() => onDelete(m)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </Card>
  );
}

function MilestoneRow({
  milestone: m,
  onEdit,
  onDelete,
}: {
  milestone: Milestone;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const today = useToday();
  const celebrate = useCelebration((s) => s.celebrate);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: m.id,
  });
  const due = countdown(today, m.targetDate);
  const done = m.completedAt !== null;

  const toggle = async () => {
    try {
      const updated = await api('milestones.setCompleted', { id: m.id, completed: !done });
      if (updated.completedAt) celebrate(updated);
    } catch {
      toast.error('Could not update the milestone.');
    }
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx(
        'group flex items-center gap-3 border-t border-rule bg-surface py-2.5 first:border-t-0',
        isDragging && 'relative z-10 rounded-lg shadow-[0_8px_24px_rgb(0_0_0/0.12)]',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="flex h-7 w-6 cursor-grab items-center justify-center rounded text-ink-faint hover:text-ink active:cursor-grabbing"
        aria-label={`Reorder ${m.title}`}
        {...attributes}
        {...listeners}
      >
        <Icon name="grip" size={16} />
      </button>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${done ? 'Mark not done' : 'Mark done'}: ${m.title}`}
        onClick={() => void toggle()}
        className={cx(
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          done
            ? 'border-accent bg-accent text-paper'
            : 'border-accent text-transparent hover:bg-accent-soft',
        )}
      >
        <Icon name="check" size={11} strokeWidth={2.5} />
      </button>
      <div className="min-w-0 flex-1">
        <span className={cx('text-[13.5px]', done ? 'text-ink-faint line-through' : 'text-ink')}>
          {m.title}
        </span>
        {m.notes ? <p className="truncate text-[12px] text-ink-faint">{m.notes}</p> : null}
      </div>
      {m.kind === 'hard-stop' ? <Pill tone="critical">Hard stop</Pill> : null}
      <span className="w-28 text-right text-[12.5px] text-ink-muted">
        {formatDate(m.targetDate)}
      </span>
      <span
        className={cx(
          'tabular w-44 text-right text-[12px] whitespace-nowrap',
          due.overdue && !done ? 'font-medium text-critical' : 'text-ink-faint',
        )}
      >
        {done ? 'completed' : due.label}
      </span>
      <div className="flex opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <IconButton icon="edit" label={`Edit ${m.title}`} size="sm" onClick={onEdit} />
        <IconButton
          icon="trash"
          label={`Delete ${m.title}`}
          size="sm"
          tone="danger"
          onClick={onDelete}
        />
      </div>
    </li>
  );
}

function MilestoneDialog({
  editing,
  onClose,
}: {
  editing: NonNullable<Editing>;
  onClose: () => void;
}) {
  const initial = editing.mode === 'edit' ? editing.milestone : null;
  const goalId = editing.mode === 'edit' ? editing.milestone.goalId : editing.goalId;
  const [title, setTitle] = useState(initial?.title ?? '');
  const [date, setDate] = useState(initial?.targetDate ?? '');
  const [value, setValue] = useState(initial?.targetValue?.toString() ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [kind, setKind] = useState<MilestoneKind>(initial?.kind ?? 'milestone');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    const targetValue = value.trim() === '' ? null : parseDecimal(value);
    const problem = !title.trim()
      ? 'Give the milestone a title.'
      : !isLocalDate(date)
        ? 'Choose a target date.'
        : value.trim() !== '' && targetValue === null
          ? 'The target value must be a number.'
          : null;
    if (problem) {
      setError(problem);
      return;
    }
    const body = {
      title: title.trim(),
      targetDate: date,
      targetValue,
      unit: unit.trim() || null,
      kind,
      notes: notes.trim(),
    };
    try {
      if (editing.mode === 'edit')
        await api('milestones.update', { id: editing.milestone.id, patch: body });
      else await api('milestones.create', { goalId, ...body });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the milestone.');
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      goal={goalId}
      title={editing.mode === 'edit' ? 'Edit milestone' : 'New milestone'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" type="submit" form="milestone-form">
            Save
          </Button>
        </>
      }
    >
      <form id="milestone-form" onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <LabeledInput
          label="Title"
          value={title}
          autoFocus
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="grid grid-cols-[1fr_110px_90px] gap-3">
          <LabeledInput
            label="Target date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <LabeledInput
            label="Target value"
            inputMode="decimal"
            placeholder="optional"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <LabeledInput
            label="Unit"
            placeholder="juz, kg…"
            maxLength={24}
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
        </div>
        <Field label="Kind">
          <SegmentedControl
            label="Kind"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'milestone', label: 'Milestone' },
              { value: 'hard-stop', label: 'Hard stop (deadline)' },
            ]}
          />
        </Field>
        <Field label="Notes" htmlFor="milestone-notes">
          <TextArea
            id="milestone-notes"
            value={notes}
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-[12.5px] text-critical">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
