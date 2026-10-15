import { useState, type SyntheticEvent } from 'react';
import { availableTasks, blockersOf, rollup } from '@shared/domain/game/roadmap';
import { formatDate } from '@shared/domain/time/localDate';
import type { Phase, RoadmapData, Task } from '@shared/schemas/game';
import { useLedger } from '../../lib/useLedger';
import { api, ApiError } from '../../lib/api';
import { parseDecimal } from '../../lib/units';
import { toast } from '../../stores/toasts';
import { cx } from '../../lib/cx';
import { Card, Pill, SectionTitle } from '../../design/Card';
import { Button, IconButton } from '../../design/Button';
import { Dialog } from '../../design/Dialog';
import { Field, LabeledInput, Select, TextArea } from '../../design/Field';
import { Meter, Ring } from '../../design/Ring';
import { Icon } from '../../design/icons';

const EMPTY: RoadmapData = { phases: [], tasks: [], dependencies: [] };

export function RoadmapPage() {
  const query = useLedger('game.roadmap', undefined, { domains: ['game'] });
  const milestones = useLedger('milestones.list', undefined, { domains: ['milestones'] });
  const data = query.data ?? EMPTY;
  const [editing, setEditing] = useState<{ task: Task | null; phaseId: string } | null>(null);
  const [editingPhase, setEditingPhase] = useState<Phase | 'new' | null>(null);
  const r = rollup(data.phases, data.tasks);
  const available = availableTasks(data.phases, data.tasks, data.dependencies).slice(0, 5);
  const milestoneOf = new Map((milestones.data ?? []).map((m) => [m.id, m]));

  const toggle = (t: Task) =>
    void api('game.setTaskDone', { id: t.id, done: !t.done }).catch(() =>
      toast.error('Could not update the task.'),
    );

  return (
    <div className="flex flex-col gap-6">
      <Card className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[auto_1fr]">
        <Ring
          value={r.overall.progress}
          size={96}
          stroke={7}
          label={`Roadmap ${Math.round(r.overall.progress * 100)}% complete`}
        >
          <span className="text-[18px] font-semibold text-ink">
            {Math.round(r.overall.progress * 100)}%
          </span>
        </Ring>
        <div>
          <div className="eyebrow">You can do now</div>
          {available.length === 0 ? (
            <p className="mt-2 text-[13px] text-ink-muted">
              Everything left is waiting on something else.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {available.map((t) => (
                <li key={t.id} className="flex items-center gap-2.5 text-[13.5px]">
                  <TaskCheck task={t} onToggle={() => toggle(t)} />
                  <span className="text-ink">{t.title}</span>
                  <span className="text-[12px] text-ink-faint">
                    {data.phases.find((p) => p.id === t.phaseId)?.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[12px] text-ink-faint">
            {r.overall.doneTasks} of {r.overall.totalTasks} tasks done. Progress is weighted by
            estimate where you have given one.
          </p>
        </div>
      </Card>

      <section aria-labelledby="phases">
        <SectionTitle
          id="phases"
          action={
            <Button size="sm" icon="plus" onClick={() => setEditingPhase('new')}>
              Add phase
            </Button>
          }
        >
          Phases
        </SectionTitle>
        <div className="flex flex-col gap-4">
          {data.phases.map((phase) => {
            const pr = r.phases.get(phase.id);
            const tasks = data.tasks.filter((t) => t.phaseId === phase.id);
            const milestone = phase.milestoneId ? milestoneOf.get(phase.milestoneId) : undefined;
            return (
              <Card key={phase.id} className="p-5" aria-labelledby={`phase-${phase.id}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 id={`phase-${phase.id}`} className="font-serif text-[18px] font-semibold">
                    {phase.title}
                  </h3>
                  {milestone ? (
                    <Pill tone="accent" icon="flag">
                      {milestone.title.length > 40 ? 'Milestone' : milestone.title} ·{' '}
                      {formatDate(milestone.targetDate)}
                    </Pill>
                  ) : null}
                  <span className="tabular ml-auto text-[12.5px] text-ink-muted">
                    {pr?.doneTasks ?? 0}/{pr?.totalTasks ?? 0}
                    {pr?.remainingHours ? ` · ${pr.remainingHours} h left` : ''}
                  </span>
                  <IconButton
                    icon="edit"
                    size="sm"
                    label={`Edit phase ${phase.title}`}
                    onClick={() => setEditingPhase(phase)}
                  />
                </div>
                {phase.description ? (
                  <p className="mt-1 text-[12.5px] text-ink-muted">{phase.description}</p>
                ) : null}
                <Meter
                  value={pr?.progress ?? 0}
                  label={`${phase.title} progress`}
                  className="mt-3"
                />
                <ul className="mt-3 flex flex-col">
                  {tasks.map((t) => {
                    const blockers = blockersOf(t.id, data.tasks, data.dependencies);
                    return (
                      <li
                        key={t.id}
                        className="group flex items-center gap-2.5 border-t border-rule py-2 first:border-t-0"
                      >
                        <TaskCheck
                          task={t}
                          disabled={blockers.length > 0 && !t.done}
                          onToggle={() => toggle(t)}
                        />
                        <div className="min-w-0 flex-1">
                          <span
                            className={cx(
                              'text-[13.5px]',
                              t.done ? 'text-ink-faint line-through' : 'text-ink',
                            )}
                          >
                            {t.title}
                          </span>
                          {blockers.length > 0 && !t.done ? (
                            <span className="ml-2 inline-flex items-center gap-1 text-[12px] text-ink-faint">
                              <Icon name="lock" size={12} /> waiting on{' '}
                              {blockers.map((b) => b.title).join(', ')}
                            </span>
                          ) : null}
                        </div>
                        {t.estimateHours ? (
                          <span className="tabular text-[12px] text-ink-faint">
                            {t.estimateHours} h
                          </span>
                        ) : null}
                        <IconButton
                          icon="edit"
                          size="sm"
                          label={`Edit task ${t.title}`}
                          className="opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
                          onClick={() => setEditing({ task: t, phaseId: phase.id })}
                        />
                      </li>
                    );
                  })}
                </ul>
                <Button
                  size="sm"
                  variant="ghost"
                  icon="plus"
                  className="mt-1"
                  onClick={() => setEditing({ task: null, phaseId: phase.id })}
                >
                  Add task
                </Button>
              </Card>
            );
          })}
        </div>
      </section>

      {editing ? (
        <TaskDialog
          data={data}
          task={editing.task}
          phaseId={editing.phaseId}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {editingPhase ? (
        <PhaseDialog
          phase={editingPhase === 'new' ? null : editingPhase}
          milestones={(milestones.data ?? []).filter((m) => m.goalId === 'game')}
          onClose={() => setEditingPhase(null)}
        />
      ) : null}
    </div>
  );
}

function TaskCheck({
  task,
  onToggle,
  disabled,
}: {
  task: Task;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={task.done}
      aria-label={`${task.done ? 'Mark not done' : 'Mark done'}: ${task.title}`}
      aria-disabled={disabled}
      title={disabled ? 'Waiting on other tasks' : undefined}
      onClick={() => {
        if (!disabled) onToggle();
      }}
      className={cx(
        'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2 transition-colors',
        task.done
          ? 'border-accent bg-accent text-paper'
          : disabled
            ? 'border-rule-strong text-transparent'
            : 'border-accent text-transparent hover:bg-accent-soft',
      )}
    >
      <Icon name="check" size={11} strokeWidth={2.5} />
    </button>
  );
}

function TaskDialog({
  data,
  task,
  phaseId,
  onClose,
}: {
  data: RoadmapData;
  task: Task | null;
  phaseId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [estimate, setEstimate] = useState(task?.estimateHours?.toString() ?? '');
  const [phase, setPhase] = useState(task?.phaseId ?? phaseId);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState('');
  const deps = task ? data.dependencies.filter((d) => d.taskId === task.id) : [];
  const byId = new Map(data.tasks.map((t) => [t.id, t]));

  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    const est = estimate.trim() === '' ? null : parseDecimal(estimate);
    if (!title.trim() || (estimate.trim() !== '' && (est === null || est <= 0))) {
      setError('A title is needed; the estimate is optional hours.');
      return;
    }
    try {
      await api('game.saveTask', {
        id: task?.id,
        phaseId: phase,
        title: title.trim(),
        notes: notes.trim(),
        estimateHours: est,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the task.');
    }
  };

  const addDep = async () => {
    if (!task || !adding) return;
    try {
      await api('game.addDependency', { taskId: task.id, dependsOnId: adding });
      setAdding('');
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the dependency.');
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      goal="game"
      width={540}
      title={task ? 'Edit task' : 'New task'}
      footer={
        <>
          {task ? (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => void api('game.deleteTask', { id: task.id }).then(onClose)}
            >
              Delete
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" type="submit" form="task-form">
            Save
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <LabeledInput
          label="Task"
          autoFocus
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <Field label="Phase" htmlFor="task-phase">
            <Select id="task-phase" value={phase} onChange={(e) => setPhase(e.target.value)}>
              {data.phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          </Field>
          <LabeledInput
            label="Estimate"
            suffix="h"
            placeholder="—"
            inputMode="decimal"
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
          />
        </div>
        <Field label="Notes" htmlFor="task-notes">
          <TextArea id="task-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>
      {task ? (
        <div className="mt-5">
          <div className="eyebrow mb-2">Waits on</div>
          {deps.length === 0 ? (
            <p className="text-[12.5px] text-ink-muted">No dependencies.</p>
          ) : null}
          <ul className="mb-2 flex flex-col gap-1">
            {deps.map((d) => (
              <li key={d.dependsOnId} className="flex items-center gap-2 text-[13px]">
                <span className="flex-1 text-ink">{byId.get(d.dependsOnId)?.title}</span>
                <IconButton
                  icon="close"
                  size="sm"
                  label={`Remove dependency on ${byId.get(d.dependsOnId)?.title ?? 'task'}`}
                  onClick={() =>
                    void api('game.removeDependency', {
                      taskId: task.id,
                      dependsOnId: d.dependsOnId,
                    })
                  }
                />
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Select
              aria-label="Add a task this one waits on"
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
            >
              <option value="">Add a prerequisite…</option>
              {data.tasks
                .filter((t) => t.id !== task.id && !deps.some((d) => d.dependsOnId === t.id))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </Select>
            <Button size="md" disabled={!adding} onClick={() => void addDep()}>
              Add
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-[12.5px] text-critical">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}

function PhaseDialog({
  phase,
  milestones,
  onClose,
}: {
  phase: Phase | null;
  milestones: { id: string; title: string }[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState(phase?.title ?? '');
  const [description, setDescription] = useState(phase?.description ?? '');
  const [milestoneId, setMilestoneId] = useState(phase?.milestoneId ?? '');
  return (
    <Dialog
      open
      onClose={onClose}
      goal="game"
      title={phase ? 'Edit phase' : 'New phase'}
      footer={
        <>
          {phase ? (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => void api('game.deletePhase', { id: phase.id }).then(onClose)}
            >
              Delete phase and its tasks
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            disabled={!title.trim()}
            onClick={() =>
              void api('game.savePhase', {
                id: phase?.id,
                title: title.trim(),
                description: description.trim(),
                milestoneId: milestoneId || null,
              }).then(onClose)
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <LabeledInput
          label="Title"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <LabeledInput
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Field label="Leads to milestone" htmlFor="phase-milestone">
          <Select
            id="phase-milestone"
            value={milestoneId}
            onChange={(e) => setMilestoneId(e.target.value)}
          >
            <option value="">None</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}
