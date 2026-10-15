import { useState, type SyntheticEvent } from 'react';
import { moduleMark } from '@shared/domain/degree/classification';
import { formatDate, isLocalDate } from '@shared/domain/time/localDate';
import {
  ASSESSMENT_KINDS,
  ASSESSMENT_STATUSES,
  type Assessment,
  type AssessmentStatus,
  type DegreeModule,
  type DegreeYear,
} from '@shared/schemas/degree';
import { api, ApiError } from '../../lib/api';
import { parseDecimal } from '../../lib/units';
import { toast } from '../../stores/toasts';
import { cx } from '../../lib/cx';
import { Card, EmptyState, Pill } from '../../design/Card';
import { Button, IconButton } from '../../design/Button';
import { Dialog } from '../../design/Dialog';
import { Field, LabeledInput, Select, SegmentedControl, TextInput } from '../../design/Field';
import { useDegree } from './useDegree';

const STATUS_LABEL: Record<AssessmentStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  submitted: 'Submitted',
  graded: 'Graded',
};

const TEMPLATES = {
  coursework: { label: 'Coursework 100%', parts: [['Coursework', 'coursework', 100]] },
  split: {
    label: 'Coursework 50% + exam 50%',
    parts: [
      ['Coursework', 'coursework', 50],
      ['Exam', 'exam', 50],
    ],
  },
  two: {
    label: 'Two assignments 40% / 60%',
    parts: [
      ['Assignment 1', 'coursework', 40],
      ['Assignment 2', 'coursework', 60],
    ],
  },
  none: { label: 'Add assessments later', parts: [] },
} as const;
type TemplateKey = keyof typeof TEMPLATES;

type Editing =
  | { kind: 'module'; yearId: string; module: DegreeModule | null }
  | { kind: 'assessment'; moduleId: string; assessment: Assessment | null }
  | { kind: 'year'; year: DegreeYear }
  | null;

export function ModulesPage() {
  const degree = useDegree();
  const [editing, setEditing] = useState<Editing>(null);
  const { years, modules, assessments } = degree.data;

  return (
    <div className="flex flex-col gap-6">
      {years.map((year) => {
        const yearModules = modules.filter((m) => m.yearId === year.id);
        const credits = yearModules.reduce((s, m) => s + m.credits, 0);
        const counts = degree.rules.levelWeights[year.level] > 0;
        return (
          <Card key={year.id} className="p-5" aria-labelledby={`year-${year.id}`}>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 id={`year-${year.id}`} className="font-serif text-[19px] font-semibold">
                {year.label}
              </h2>
              <Pill tone={counts ? 'accent' : 'neutral'}>
                {counts ? 'Counts towards your class' : 'Does not count'}
              </Pill>
              <span className="text-[12.5px] text-ink-muted">
                {year.startDate || year.endDate
                  ? `${year.startDate ? formatDate(year.startDate) : '…'} – ${year.endDate ? formatDate(year.endDate) : '…'}`
                  : 'Dates not set'}
              </span>
              <IconButton
                icon="edit"
                size="sm"
                label={`Edit ${year.label}`}
                onClick={() => setEditing({ kind: 'year', year })}
              />
              <span
                className={cx(
                  'tabular ml-auto text-[12.5px]',
                  credits === degree.rules.creditsPerLevel ? 'text-positive' : 'text-ink-muted',
                )}
              >
                {credits} / {degree.rules.creditsPerLevel} credits
              </span>
              <Button
                size="sm"
                icon="plus"
                onClick={() => setEditing({ kind: 'module', yearId: year.id, module: null })}
              >
                Add module
              </Button>
            </div>
            {yearModules.length === 0 ? (
              <EmptyState icon="cap" title="No modules yet">
                Add each module with its credits, then its assessments with weights and due dates. A
                typical Level {year.level} year is {degree.rules.creditsPerLevel} credits.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-3">
                {yearModules.map((m) => (
                  <ModuleCard
                    key={m.id}
                    module={m}
                    assessments={assessments.filter((a) => a.moduleId === m.id)}
                    onEditModule={() => setEditing({ kind: 'module', yearId: year.id, module: m })}
                    onAddAssessment={() =>
                      setEditing({ kind: 'assessment', moduleId: m.id, assessment: null })
                    }
                    onEditAssessment={(a) =>
                      setEditing({ kind: 'assessment', moduleId: m.id, assessment: a })
                    }
                  />
                ))}
              </div>
            )}
          </Card>
        );
      })}
      {editing?.kind === 'module' ? (
        <ModuleDialog
          yearId={editing.yearId}
          module={editing.module}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {editing?.kind === 'assessment' ? (
        <AssessmentDialog
          moduleId={editing.moduleId}
          assessment={editing.assessment}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {editing?.kind === 'year' ? (
        <YearDialog year={editing.year} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}

function ModuleCard({
  module: m,
  assessments,
  onEditModule,
  onAddAssessment,
  onEditAssessment,
}: {
  module: DegreeModule;
  assessments: Assessment[];
  onEditModule: () => void;
  onAddAssessment: () => void;
  onEditAssessment: (a: Assessment) => void;
}) {
  const mark = moduleMark({
    assessments: assessments.map((a) => ({ id: a.id, weight: a.weight, grade: a.grade })),
  });
  const totalWeight = assessments.reduce((s, a) => s + a.weight, 0);
  return (
    <div className="rounded-lg border border-rule" aria-label={`Module ${m.title}`} role="group">
      <div className="flex flex-wrap items-center gap-3 border-b border-rule px-4 py-2.5">
        {m.code ? <span className="font-mono text-[12px] text-ink-muted">{m.code}</span> : null}
        <span className="text-[14px] font-semibold text-ink">{m.title}</span>
        <span className="text-[12.5px] text-ink-faint">{m.credits} credits</span>
        <span className="ml-auto text-[12.5px] text-ink-muted">
          {mark.mark === null
            ? 'No grades yet'
            : `Module mark ${mark.mark.toFixed(1)}%${mark.gradedWeight < totalWeight ? ' so far' : ''}`}
        </span>
        <IconButton icon="edit" size="sm" label={`Edit module ${m.title}`} onClick={onEditModule} />
      </div>
      {assessments.length > 0 ? (
        <table className="w-full text-left text-[13px]">
          <thead className="sr-only">
            <tr>
              <th>Assessment</th>
              <th>Weight</th>
              <th>Due</th>
              <th>Status</th>
              <th>Grade</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {assessments.map((a) => (
              <tr key={a.id} className="border-b border-rule last:border-0">
                <td className="px-4 py-2 text-ink">
                  {a.title} <span className="ml-1 text-[12px] text-ink-faint">{a.kind}</span>
                </td>
                <td className="tabular w-16 px-2 py-2 text-ink-muted">{a.weight}%</td>
                <td className="w-32 px-2 py-2 text-ink-muted">
                  {a.dueDate ? formatDate(a.dueDate) : '—'}
                </td>
                <td className="w-28 px-2 py-2">
                  <Pill
                    tone={
                      a.status === 'graded'
                        ? 'positive'
                        : a.status === 'submitted'
                          ? 'accent'
                          : 'neutral'
                    }
                  >
                    {STATUS_LABEL[a.status]}
                  </Pill>
                </td>
                <td className="tabular w-20 px-2 py-2 font-semibold text-ink">
                  {a.grade === null ? '—' : `${a.grade}%`}
                </td>
                <td className="w-10 px-2 py-2">
                  <IconButton
                    icon="edit"
                    size="sm"
                    label={`Edit ${a.title}`}
                    onClick={() => onEditAssessment(a)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <div className="flex items-center gap-3 px-4 py-2">
        <Button size="sm" variant="ghost" icon="plus" onClick={onAddAssessment}>
          Add assessment
        </Button>
        {assessments.length > 0 && Math.abs(totalWeight - 100) > 0.01 ? (
          <span className="text-[12px] text-warning">
            Weights add up to {totalWeight}%, not 100%.
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ModuleDialog({
  yearId,
  module,
  onClose,
}: {
  yearId: string;
  module: DegreeModule | null;
  onClose: () => void;
}) {
  const [code, setCode] = useState(module?.code ?? '');
  const [title, setTitle] = useState(module?.title ?? '');
  const [credits, setCredits] = useState(String(module?.credits ?? 20));
  const [template, setTemplate] = useState<TemplateKey>('coursework');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    const c = Number(credits);
    if (!title.trim() || !Number.isInteger(c) || c < 1 || c > 120) {
      setError('A title and whole credits (1–120) are needed.');
      return;
    }
    try {
      if (module) {
        await api('degree.updateModule', {
          id: module.id,
          patch: { code: code.trim(), title: title.trim(), credits: c },
        });
      } else {
        const created = await api('degree.createModule', {
          yearId,
          code: code.trim(),
          title: title.trim(),
          credits: c,
        });
        for (const [partTitle, kind, weight] of TEMPLATES[template].parts) {
          await api('degree.createAssessment', {
            moduleId: created.id,
            title: partTitle,
            kind,
            weight,
          });
        }
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the module.');
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      goal="degree"
      title={module ? 'Edit module' : 'Add module'}
      footer={
        <>
          {module ? (
            confirmDelete ? (
              <Button
                variant="danger"
                className="mr-auto"
                onClick={() => void api('degree.deleteModule', { id: module.id }).then(onClose)}
              >
                Delete module and its assessments
              </Button>
            ) : (
              <Button variant="ghost" className="mr-auto" onClick={() => setConfirmDelete(true)}>
                Delete…
              </Button>
            )
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" type="submit" form="module-form">
            Save
          </Button>
        </>
      }
    >
      <form id="module-form" onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <div className="grid grid-cols-[120px_1fr_90px] gap-3">
          <LabeledInput
            label="Code"
            placeholder="optional"
            value={code}
            maxLength={20}
            onChange={(e) => setCode(e.target.value)}
          />
          <LabeledInput
            label="Title"
            autoFocus
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
          <LabeledInput
            label="Credits"
            inputMode="numeric"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
          />
        </div>
        {module ? null : (
          <Field label="Assessments">
            <Select
              value={template}
              onChange={(e) => setTemplate(e.target.value as TemplateKey)}
              aria-label="Assessment template"
            >
              {Object.entries(TEMPLATES).map(([k, t]) => (
                <option key={k} value={k}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {error ? (
          <p role="alert" className="text-[12.5px] text-critical">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

function AssessmentDialog({
  moduleId,
  assessment,
  onClose,
}: {
  moduleId: string;
  assessment: Assessment | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(assessment?.title ?? '');
  const [kind, setKind] = useState<Assessment['kind']>(assessment?.kind ?? 'coursework');
  const [weight, setWeight] = useState(String(assessment?.weight ?? 100));
  const [due, setDue] = useState(assessment?.dueDate ?? '');
  const [status, setStatus] = useState<AssessmentStatus>(assessment?.status ?? 'not-started');
  const [grade, setGrade] = useState(
    assessment?.grade === null || assessment === null ? '' : String(assessment.grade),
  );
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    const w = parseDecimal(weight);
    const g = grade.trim() === '' ? null : parseDecimal(grade);
    const problem = !title.trim()
      ? 'Give the assessment a title.'
      : w === null || w < 0 || w > 100
        ? 'The weight is a percentage from 0 to 100.'
        : due !== '' && !isLocalDate(due)
          ? 'Choose a valid due date.'
          : grade.trim() !== '' && (g === null || g < 0 || g > 100)
            ? 'The grade is a percentage from 0 to 100.'
            : null;
    if (problem || w === null) {
      setError(problem);
      return;
    }
    const body = { title: title.trim(), kind, weight: w, dueDate: due || null, status, grade: g };
    try {
      if (assessment) await api('degree.updateAssessment', { id: assessment.id, patch: body });
      else await api('degree.createAssessment', { moduleId, ...body });
      if (g !== null && assessment?.grade === null) toast.success(`Grade recorded: ${g}%.`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the assessment.');
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      goal="degree"
      title={assessment ? 'Edit assessment' : 'Add assessment'}
      footer={
        <>
          {assessment ? (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() =>
                void api('degree.deleteAssessment', { id: assessment.id }).then(onClose)
              }
            >
              Delete
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" type="submit" form="assessment-form">
            Save
          </Button>
        </>
      }
    >
      <form id="assessment-form" onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <div className="grid grid-cols-[1fr_150px] gap-3">
          <LabeledInput
            label="Title"
            autoFocus
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Field label="Type" htmlFor="assessment-kind">
            <Select
              id="assessment-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as Assessment['kind'])}
            >
              {ASSESSMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k[0]?.toUpperCase()}
                  {k.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <LabeledInput
            label="Weight"
            suffix="%"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <Field label="Due date" htmlFor="assessment-due">
            <TextInput
              id="assessment-due"
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </Field>
          <LabeledInput
            label="Grade"
            suffix="%"
            placeholder="—"
            inputMode="decimal"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          />
        </div>
        <Field label="Status">
          <SegmentedControl
            size="sm"
            label="Status"
            value={grade.trim() !== '' ? 'graded' : status}
            onChange={setStatus}
            options={ASSESSMENT_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
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

function YearDialog({ year, onClose }: { year: DegreeYear; onClose: () => void }) {
  const [label, setLabel] = useState(year.label);
  const [start, setStart] = useState(year.startDate ?? '');
  const [end, setEnd] = useState(year.endDate ?? '');
  return (
    <Dialog
      open
      onClose={onClose}
      goal="degree"
      title="Edit year"
      description="Term dates are yours to enter once Arden confirms them."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            onClick={() => {
              void api('degree.updateYear', {
                id: year.id,
                patch: {
                  label: label.trim() || year.label,
                  startDate: start || null,
                  endDate: end || null,
                },
              }).then(onClose);
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <LabeledInput label="Name" value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <LabeledInput
            label="Starts"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <LabeledInput
            label="Ends"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
      </div>
    </Dialog>
  );
}
