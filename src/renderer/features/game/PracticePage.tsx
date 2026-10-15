import { useState } from 'react';
import { formatDate } from '@shared/domain/time/localDate';
import { PROJECT_STATUSES, type PracticeProject, type ProjectStatus } from '@shared/schemas/game';
import { useLedger } from '../../lib/useLedger';
import { api } from '../../lib/api';
import { Card } from '../../design/Card';
import { Button } from '../../design/Button';
import { Dialog } from '../../design/Dialog';
import { Field, LabeledInput, Select, TextArea } from '../../design/Field';

const COLUMN: Record<ProjectStatus, string> = {
  idea: 'Ideas',
  active: 'In progress',
  done: 'Finished',
  shelved: 'Shelved',
};

/**
 * Small, finishable projects to learn on — usually clones. A board by status, with
 * the lessons each one taught, because the lessons are the point.
 */
export function PracticePage() {
  const query = useLedger('game.projects', undefined, { domains: ['game'] });
  const [editing, setEditing] = useState<PracticeProject | 'new' | null>(null);
  const projects = query.data ?? [];
  const move = (p: PracticeProject, status: ProjectStatus) =>
    void api('game.saveProject', { ...p, status });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-muted">
          Finish small things. A finished Pong teaches more than half of an ambitious game.
        </p>
        <Button size="sm" icon="plus" onClick={() => setEditing('new')}>
          New project
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PROJECT_STATUSES.map((status) => (
          <section
            key={status}
            aria-labelledby={`col-${status}`}
            className="rounded-xl bg-sunken/60 p-3"
          >
            <h2
              id={`col-${status}`}
              className="mb-2 px-1 text-[12.5px] font-semibold text-ink-muted"
            >
              {COLUMN[status]}{' '}
              <span className="font-normal text-ink-faint">
                {projects.filter((p) => p.status === status).length}
              </span>
            </h2>
            <ul className="flex flex-col gap-2">
              {projects
                .filter((p) => p.status === status)
                .map((p) => (
                  <li key={p.id}>
                    <Card as="div" className="p-3">
                      <button
                        type="button"
                        className="block w-full text-left"
                        onClick={() => setEditing(p)}
                      >
                        <div className="text-[13.5px] font-semibold text-ink">{p.title}</div>
                        <div className="text-[11.5px] text-ink-faint">
                          {p.startedOn
                            ? `Started ${formatDate(p.startedOn, { year: false })}`
                            : 'Not started'}
                          {p.finishedOn
                            ? ` · finished ${formatDate(p.finishedOn, { year: false })}`
                            : ''}
                        </div>
                        {p.lessons ? (
                          <p className="mt-1.5 line-clamp-3 text-[12.5px] text-ink-muted">
                            {p.lessons}
                          </p>
                        ) : null}
                      </button>
                      <Select
                        aria-label={`Move ${p.title}`}
                        className="mt-2 h-7 text-[12px]"
                        value={p.status}
                        onChange={(e) => move(p, e.target.value as ProjectStatus)}
                      >
                        {PROJECT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {COLUMN[s]}
                          </option>
                        ))}
                      </Select>
                    </Card>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
      {editing ? (
        <ProjectDialog
          project={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function ProjectDialog({
  project,
  onClose,
}: {
  project: PracticeProject | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(project?.title ?? '');
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'idea');
  const [lessons, setLessons] = useState(project?.lessons ?? '');
  const [notes, setNotes] = useState(project?.notes ?? '');
  return (
    <Dialog
      open
      onClose={onClose}
      goal="game"
      width={540}
      title={project ? project.title : 'New practice project'}
      footer={
        <>
          {project ? (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => void api('game.deleteProject', { id: project.id }).then(onClose)}
            >
              Delete
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            disabled={!title.trim()}
            onClick={() =>
              void api('game.saveProject', {
                id: project?.id,
                title: title.trim(),
                status,
                startedOn: project?.startedOn ?? null,
                finishedOn: project?.finishedOn ?? null,
                lessons: lessons.trim(),
                notes: notes.trim(),
              }).then(onClose)
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[1fr_160px] gap-3">
          <LabeledInput
            label="Project"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Field label="Status" htmlFor="project-status">
            <Select
              id="project-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {COLUMN[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label="Lessons learned"
          htmlFor="project-lessons"
          hint="What would you do differently next time?"
        >
          <TextArea
            id="project-lessons"
            className="min-h-[120px]"
            value={lessons}
            onChange={(e) => setLessons(e.target.value)}
          />
        </Field>
        <Field label="Notes" htmlFor="project-notes">
          <TextArea id="project-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
