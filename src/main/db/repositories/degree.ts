import type {
  Assessment,
  AssessmentStatus,
  DegreeData,
  DegreeModule,
  DegreeYear,
  StudySession,
} from '@shared/schemas/degree';
import { notFound } from '../../errors';
import { newId, type RepoContext } from './context';

interface YearRow {
  id: string;
  level: 4 | 5 | 6;
  label: string;
  start_date: string | null;
  end_date: string | null;
}
interface ModuleRow {
  id: string;
  year_id: string;
  code: string;
  title: string;
  credits: number;
  notes: string;
  sort_order: number;
}
interface AssessmentRow {
  id: string;
  module_id: string;
  title: string;
  kind: Assessment['kind'];
  weight: number;
  due_date: string | null;
  status: AssessmentStatus;
  grade: number | null;
  notes: string;
}

const toYear = (r: YearRow): DegreeYear => ({
  id: r.id,
  level: r.level,
  label: r.label,
  startDate: r.start_date,
  endDate: r.end_date,
});
const toModule = (r: ModuleRow): DegreeModule => ({
  id: r.id,
  yearId: r.year_id,
  code: r.code,
  title: r.title,
  credits: r.credits,
  notes: r.notes,
  sortOrder: r.sort_order,
});
const toAssessment = (r: AssessmentRow): Assessment => ({
  id: r.id,
  moduleId: r.module_id,
  title: r.title,
  kind: r.kind,
  weight: r.weight,
  dueDate: r.due_date,
  status: r.status,
  grade: r.grade,
  notes: r.notes,
});

export function degreeData(ctx: RepoContext): DegreeData {
  return {
    years: ctx.db
      .prepare<[], YearRow>('SELECT * FROM degree_years ORDER BY sort_order, level')
      .all()
      .map(toYear),
    modules: ctx.db
      .prepare<[], ModuleRow>('SELECT * FROM modules ORDER BY sort_order, created_at')
      .all()
      .map(toModule),
    assessments: ctx.db
      .prepare<[], AssessmentRow>(
        'SELECT * FROM assessments ORDER BY sort_order, due_date, created_at',
      )
      .all()
      .map(toAssessment),
  };
}

export function updateYear(
  ctx: RepoContext,
  id: string,
  patch: { label?: string; startDate?: string | null; endDate?: string | null },
): DegreeYear {
  const row = ctx.db.prepare<[string], YearRow>('SELECT * FROM degree_years WHERE id = ?').get(id);
  if (!row) throw notFound('Year', id);
  const next = { ...toYear(row), ...patch };
  ctx.db
    .prepare(
      'UPDATE degree_years SET label = ?, start_date = ?, end_date = ?, updated_at = ? WHERE id = ?',
    )
    .run(next.label, next.startDate, next.endDate, ctx.clock.nowIso(), id);
  return next;
}

export type ModuleInput = Omit<DegreeModule, 'id' | 'sortOrder'>;

export function getModule(ctx: RepoContext, id: string): DegreeModule {
  const row = ctx.db.prepare<[string], ModuleRow>('SELECT * FROM modules WHERE id = ?').get(id);
  if (!row) throw notFound('Module', id);
  return toModule(row);
}

export function createModule(ctx: RepoContext, input: ModuleInput): DegreeModule {
  if (!ctx.db.prepare('SELECT 1 FROM degree_years WHERE id = ?').get(input.yearId))
    throw notFound('Year', input.yearId);
  const id = newId();
  const now = ctx.clock.nowIso();
  const order =
    ctx.db
      .prepare<[string], { n: number | null }>(
        'SELECT MAX(sort_order) + 1 AS n FROM modules WHERE year_id = ?',
      )
      .get(input.yearId)?.n ?? 0;
  ctx.db
    .prepare(
      'INSERT INTO modules (id, year_id, code, title, credits, notes, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(id, input.yearId, input.code, input.title, input.credits, input.notes, order, now, now);
  return getModule(ctx, id);
}

export function updateModule(
  ctx: RepoContext,
  id: string,
  patch: Partial<ModuleInput>,
): DegreeModule {
  const next = { ...getModule(ctx, id), ...patch };
  ctx.db
    .prepare(
      'UPDATE modules SET year_id = ?, code = ?, title = ?, credits = ?, notes = ?, updated_at = ? WHERE id = ?',
    )
    .run(next.yearId, next.code, next.title, next.credits, next.notes, ctx.clock.nowIso(), id);
  return getModule(ctx, id);
}

export function deleteModule(ctx: RepoContext, id: string): void {
  if (ctx.db.prepare('DELETE FROM modules WHERE id = ?').run(id).changes === 0)
    throw notFound('Module', id);
}

export type AssessmentInput = Omit<Assessment, 'id'>;

export function getAssessment(ctx: RepoContext, id: string): Assessment {
  const row = ctx.db
    .prepare<[string], AssessmentRow>('SELECT * FROM assessments WHERE id = ?')
    .get(id);
  if (!row) throw notFound('Assessment', id);
  return toAssessment(row);
}

/** A grade implies the assessment is graded; clearing it moves it back to submitted. */
function normaliseStatus(a: AssessmentInput): AssessmentInput {
  if (a.grade !== null) return { ...a, status: 'graded' };
  if (a.status === 'graded') return { ...a, status: 'submitted' };
  return a;
}

export function createAssessment(ctx: RepoContext, input: AssessmentInput): Assessment {
  getModule(ctx, input.moduleId);
  const a = normaliseStatus(input);
  const id = newId();
  const now = ctx.clock.nowIso();
  ctx.db
    .prepare(
      `INSERT INTO assessments (id, module_id, title, kind, weight, due_date, status, grade, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      a.moduleId,
      a.title,
      a.kind,
      a.weight,
      a.dueDate,
      a.status,
      a.grade,
      a.notes,
      now,
      now,
    );
  return getAssessment(ctx, id);
}

export function updateAssessment(
  ctx: RepoContext,
  id: string,
  patch: Partial<AssessmentInput>,
): Assessment {
  const a = normaliseStatus({ ...getAssessment(ctx, id), ...patch });
  ctx.db
    .prepare(
      `UPDATE assessments SET module_id = ?, title = ?, kind = ?, weight = ?, due_date = ?, status = ?, grade = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      a.moduleId,
      a.title,
      a.kind,
      a.weight,
      a.dueDate,
      a.status,
      a.grade,
      a.notes,
      ctx.clock.nowIso(),
      id,
    );
  return getAssessment(ctx, id);
}

export function deleteAssessment(ctx: RepoContext, id: string): void {
  if (ctx.db.prepare('DELETE FROM assessments WHERE id = ?').run(id).changes === 0)
    throw notFound('Assessment', id);
}

interface StudyRow {
  id: string;
  date: string;
  minutes: number;
  module_id: string | null;
  note: string;
}

export function listStudySessions(ctx: RepoContext, from: string, to: string): StudySession[] {
  return ctx.db
    .prepare<[string, string], StudyRow>(
      'SELECT * FROM study_sessions WHERE date BETWEEN ? AND ? ORDER BY date, created_at',
    )
    .all(from, to)
    .map((r) => ({
      id: r.id,
      date: r.date,
      minutes: r.minutes,
      moduleId: r.module_id,
      note: r.note,
    }));
}

export function logStudy(
  ctx: RepoContext,
  input: { date: string; minutes: number; moduleId: string | null; note: string },
): StudySession {
  if (input.moduleId) getModule(ctx, input.moduleId);
  const id = newId();
  ctx.db
    .prepare(
      'INSERT INTO study_sessions (id, date, minutes, module_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(id, input.date, input.minutes, input.moduleId, input.note, ctx.clock.nowIso());
  return { id, ...input };
}

export function deleteStudy(ctx: RepoContext, id: string): void {
  if (ctx.db.prepare('DELETE FROM study_sessions WHERE id = ?').run(id).changes === 0)
    throw notFound('Study session', id);
}
