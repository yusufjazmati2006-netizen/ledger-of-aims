import { wouldCreateCycle, type Dependency } from '@shared/domain/game/roadmap';
import type {
  DevlogEntry,
  EngineDecision,
  LearningItem,
  Phase,
  PracticeProject,
  ProjectStatus,
  ResourceLink,
  RoadmapData,
  SteamItem,
  Task,
  TimeEntryRecord,
} from '@shared/schemas/game';
import { DomainError, notFound } from '../../errors';
import { newId, type RepoContext } from './context';

// ── Roadmap ─────────────────────────────────────────────────────────────────────

interface PhaseRow {
  id: string;
  title: string;
  description: string;
  milestone_id: string | null;
  sort_order: number;
}
interface TaskRow {
  id: string;
  phase_id: string;
  title: string;
  notes: string;
  estimate_hours: number | null;
  done: number;
  done_at: string | null;
  sort_order: number;
}

export function roadmap(ctx: RepoContext): RoadmapData {
  return {
    phases: ctx.db
      .prepare<[], PhaseRow>('SELECT * FROM roadmap_phases ORDER BY sort_order')
      .all()
      .map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        milestoneId: r.milestone_id,
        sortOrder: r.sort_order,
      })),
    tasks: ctx.db
      .prepare<[], TaskRow>('SELECT * FROM roadmap_tasks ORDER BY sort_order, created_at')
      .all()
      .map((r) => ({
        id: r.id,
        phaseId: r.phase_id,
        title: r.title,
        notes: r.notes,
        estimateHours: r.estimate_hours,
        done: r.done === 1,
        doneAt: r.done_at,
        sortOrder: r.sort_order,
      })),
    dependencies: ctx.db
      .prepare<[], { task_id: string; depends_on_id: string }>('SELECT * FROM task_dependencies')
      .all()
      .map((r) => ({ taskId: r.task_id, dependsOnId: r.depends_on_id })),
  };
}

export function savePhase(
  ctx: RepoContext,
  input: { id?: string; title: string; description: string; milestoneId: string | null },
): Phase {
  const now = ctx.clock.nowIso();
  if (input.id) {
    const r = ctx.db
      .prepare(
        'UPDATE roadmap_phases SET title = ?, description = ?, milestone_id = ? WHERE id = ?',
      )
      .run(input.title, input.description, input.milestoneId, input.id);
    if (r.changes === 0) throw notFound('Phase', input.id);
  } else {
    const order =
      ctx.db
        .prepare<[], { n: number | null }>('SELECT MAX(sort_order) + 1 AS n FROM roadmap_phases')
        .get()?.n ?? 0;
    input = { ...input, id: newId() };
    ctx.db
      .prepare(
        'INSERT INTO roadmap_phases (id, title, description, milestone_id, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(input.id, input.title, input.description, input.milestoneId, order, now);
  }
  const phase = roadmap(ctx).phases.find((p) => p.id === input.id);
  if (!phase) throw notFound('Phase', input.id ?? '');
  return phase;
}

export function deletePhase(ctx: RepoContext, id: string): void {
  if (ctx.db.prepare('DELETE FROM roadmap_phases WHERE id = ?').run(id).changes === 0)
    throw notFound('Phase', id);
}

export function saveTask(
  ctx: RepoContext,
  input: {
    id?: string;
    phaseId: string;
    title: string;
    notes: string;
    estimateHours: number | null;
  },
): Task {
  const now = ctx.clock.nowIso();
  let id = input.id;
  if (id) {
    const r = ctx.db
      .prepare(
        'UPDATE roadmap_tasks SET phase_id = ?, title = ?, notes = ?, estimate_hours = ?, updated_at = ? WHERE id = ?',
      )
      .run(input.phaseId, input.title, input.notes, input.estimateHours, now, id);
    if (r.changes === 0) throw notFound('Task', id);
  } else {
    id = newId();
    const order =
      ctx.db
        .prepare<[string], { n: number | null }>(
          'SELECT MAX(sort_order) + 1 AS n FROM roadmap_tasks WHERE phase_id = ?',
        )
        .get(input.phaseId)?.n ?? 0;
    ctx.db
      .prepare(
        'INSERT INTO roadmap_tasks (id, phase_id, title, notes, estimate_hours, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(id, input.phaseId, input.title, input.notes, input.estimateHours, order, now, now);
  }
  const task = roadmap(ctx).tasks.find((t) => t.id === id);
  if (!task) throw notFound('Task', id);
  return task;
}

export function setTaskDone(ctx: RepoContext, id: string, done: boolean): Task {
  const now = ctx.clock.nowIso();
  const r = ctx.db
    .prepare('UPDATE roadmap_tasks SET done = ?, done_at = ?, updated_at = ? WHERE id = ?')
    .run(done ? 1 : 0, done ? now : null, now, id);
  if (r.changes === 0) throw notFound('Task', id);
  const task = roadmap(ctx).tasks.find((t) => t.id === id);
  if (!task) throw notFound('Task', id);
  return task;
}

export function deleteTask(ctx: RepoContext, id: string): void {
  if (ctx.db.prepare('DELETE FROM roadmap_tasks WHERE id = ?').run(id).changes === 0)
    throw notFound('Task', id);
}

export function addDependency(ctx: RepoContext, dep: Dependency): Dependency[] {
  const data = roadmap(ctx);
  const ids = new Set(data.tasks.map((t) => t.id));
  if (!ids.has(dep.taskId)) throw notFound('Task', dep.taskId);
  if (!ids.has(dep.dependsOnId)) throw notFound('Task', dep.dependsOnId);
  if (wouldCreateCycle(data.dependencies, dep.taskId, dep.dependsOnId)) {
    throw new DomainError('CONFLICT', 'That would make the tasks wait on each other in a loop.');
  }
  ctx.db
    .prepare('INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)')
    .run(dep.taskId, dep.dependsOnId);
  return roadmap(ctx).dependencies;
}

export function removeDependency(ctx: RepoContext, dep: Dependency): Dependency[] {
  ctx.db
    .prepare('DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?')
    .run(dep.taskId, dep.dependsOnId);
  return roadmap(ctx).dependencies;
}

// ── Learning path ───────────────────────────────────────────────────────────────

interface LearningRow {
  id: string;
  category: string;
  title: string;
  notes: string;
  links: string;
  done: number;
  sort_order: number;
}

function parseLinks(json: string): ResourceLink[] {
  try {
    const value = JSON.parse(json) as unknown;
    return Array.isArray(value)
      ? value.filter(
          (l): l is ResourceLink =>
            typeof l === 'object' && l !== null && 'url' in l && 'label' in l,
        )
      : [];
  } catch {
    return [];
  }
}

export function listLearning(ctx: RepoContext): {
  items: LearningItem[];
  decisions: EngineDecision[];
} {
  return {
    items: ctx.db
      .prepare<[], LearningRow>('SELECT * FROM learning_items ORDER BY sort_order, created_at')
      .all()
      .map((r) => ({
        id: r.id,
        category: r.category,
        title: r.title,
        notes: r.notes,
        links: parseLinks(r.links),
        done: r.done === 1,
        sortOrder: r.sort_order,
      })),
    decisions: ctx.db
      .prepare<[], EngineDecision>(
        'SELECT id, date, engine, decision, rationale FROM engine_decisions ORDER BY date DESC, created_at DESC',
      )
      .all(),
  };
}

export function saveLearningItem(
  ctx: RepoContext,
  input: {
    id?: string;
    category: string;
    title: string;
    notes: string;
    links: ResourceLink[];
    done: boolean;
  },
): LearningItem {
  const now = ctx.clock.nowIso();
  const id = input.id ?? newId();
  if (input.id) {
    const r = ctx.db
      .prepare(
        'UPDATE learning_items SET category = ?, title = ?, notes = ?, links = ?, done = ?, updated_at = ? WHERE id = ?',
      )
      .run(
        input.category,
        input.title,
        input.notes,
        JSON.stringify(input.links),
        input.done ? 1 : 0,
        now,
        id,
      );
    if (r.changes === 0) throw notFound('Learning item', id);
  } else {
    const order =
      ctx.db
        .prepare<[], { n: number | null }>('SELECT MAX(sort_order) + 1 AS n FROM learning_items')
        .get()?.n ?? 0;
    ctx.db
      .prepare(
        'INSERT INTO learning_items (id, category, title, notes, links, done, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        input.category,
        input.title,
        input.notes,
        JSON.stringify(input.links),
        input.done ? 1 : 0,
        order,
        now,
        now,
      );
  }
  const item = listLearning(ctx).items.find((i) => i.id === id);
  if (!item) throw notFound('Learning item', id);
  return item;
}

export function deleteLearningItem(ctx: RepoContext, id: string): void {
  if (ctx.db.prepare('DELETE FROM learning_items WHERE id = ?').run(id).changes === 0)
    throw notFound('Learning item', id);
}

export function addDecision(
  ctx: RepoContext,
  input: { date: string; engine: string; decision: string; rationale: string },
): EngineDecision {
  const id = newId();
  ctx.db
    .prepare(
      'INSERT INTO engine_decisions (id, date, engine, decision, rationale, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(id, input.date, input.engine, input.decision, input.rationale, ctx.clock.nowIso());
  return { id, ...input };
}

export function deleteDecision(ctx: RepoContext, id: string): void {
  if (ctx.db.prepare('DELETE FROM engine_decisions WHERE id = ?').run(id).changes === 0)
    throw notFound('Decision', id);
}

// ── Practice projects ───────────────────────────────────────────────────────────

interface ProjectRow {
  id: string;
  title: string;
  status: ProjectStatus;
  started_on: string | null;
  finished_on: string | null;
  lessons: string;
  notes: string;
  sort_order: number;
}

export function listProjects(ctx: RepoContext): PracticeProject[] {
  return ctx.db
    .prepare<[], ProjectRow>('SELECT * FROM practice_projects ORDER BY sort_order, created_at')
    .all()
    .map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      startedOn: r.started_on,
      finishedOn: r.finished_on,
      lessons: r.lessons,
      notes: r.notes,
      sortOrder: r.sort_order,
    }));
}

/** Saves a project; moving to active/done fills in the start/finish dates if empty. */
export function saveProject(
  ctx: RepoContext,
  input: {
    id?: string;
    title: string;
    status: ProjectStatus;
    startedOn: string | null;
    finishedOn: string | null;
    lessons: string;
    notes: string;
  },
): PracticeProject {
  const today = ctx.clock.today();
  const now = ctx.clock.nowIso();
  const startedOn =
    input.startedOn ?? (input.status === 'active' || input.status === 'done' ? today : null);
  const finishedOn = input.finishedOn ?? (input.status === 'done' ? today : null);
  const id = input.id ?? newId();
  if (input.id) {
    const r = ctx.db
      .prepare(
        'UPDATE practice_projects SET title = ?, status = ?, started_on = ?, finished_on = ?, lessons = ?, notes = ?, updated_at = ? WHERE id = ?',
      )
      .run(input.title, input.status, startedOn, finishedOn, input.lessons, input.notes, now, id);
    if (r.changes === 0) throw notFound('Project', id);
  } else {
    const order =
      ctx.db
        .prepare<[], { n: number | null }>('SELECT MAX(sort_order) + 1 AS n FROM practice_projects')
        .get()?.n ?? 0;
    ctx.db
      .prepare(
        `INSERT INTO practice_projects (id, title, status, started_on, finished_on, lessons, notes, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.title,
        input.status,
        startedOn,
        finishedOn,
        input.lessons,
        input.notes,
        order,
        now,
        now,
      );
  }
  const project = listProjects(ctx).find((p) => p.id === id);
  if (!project) throw notFound('Project', id);
  return project;
}

export function deleteProject(ctx: RepoContext, id: string): void {
  if (ctx.db.prepare('DELETE FROM practice_projects WHERE id = ?').run(id).changes === 0)
    throw notFound('Project', id);
}

// ── Time tracking ───────────────────────────────────────────────────────────────

interface TimeRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  kind: 'timer' | 'manual';
  focus: number;
  note: string;
}
const toEntry = (r: TimeRow): TimeEntryRecord => ({
  id: r.id,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  kind: r.kind,
  focus: r.focus === 1,
  note: r.note,
});

export function listTime(ctx: RepoContext, fromIso: string, toIso: string): TimeEntryRecord[] {
  return ctx.db
    .prepare<[string, string], TimeRow>(
      'SELECT * FROM time_entries WHERE (started_at < ? AND (ended_at IS NULL OR ended_at > ?)) ORDER BY started_at',
    )
    .all(toIso, fromIso)
    .map(toEntry);
}

export function runningTimer(ctx: RepoContext): TimeEntryRecord | null {
  const row = ctx.db
    .prepare<[], TimeRow>('SELECT * FROM time_entries WHERE ended_at IS NULL LIMIT 1')
    .get();
  return row ? toEntry(row) : null;
}

export function startTimer(ctx: RepoContext, note: string): TimeEntryRecord {
  if (runningTimer(ctx)) throw new DomainError('CONFLICT', 'A timer is already running.');
  const id = newId();
  ctx.db
    .prepare(
      "INSERT INTO time_entries (id, started_at, ended_at, kind, note, created_at) VALUES (?, ?, NULL, 'timer', ?, ?)",
    )
    .run(id, ctx.clock.nowIso(), note, ctx.clock.nowIso());
  return runningTimer(ctx) as TimeEntryRecord;
}

export function stopTimer(
  ctx: RepoContext,
  input: { note: string; focus: boolean },
): TimeEntryRecord {
  const running = runningTimer(ctx);
  if (!running) throw new DomainError('CONFLICT', 'No timer is running.');
  ctx.db
    .prepare('UPDATE time_entries SET ended_at = ?, note = ?, focus = ? WHERE id = ?')
    .run(ctx.clock.nowIso(), input.note || running.note, input.focus ? 1 : 0, running.id);
  return toEntry(
    ctx.db
      .prepare<[string], TimeRow>('SELECT * FROM time_entries WHERE id = ?')
      .get(running.id) as TimeRow,
  );
}

export function addManualTime(
  ctx: RepoContext,
  input: { startIso: string; endIso: string; focus: boolean; note: string },
): TimeEntryRecord {
  const id = newId();
  ctx.db
    .prepare(
      "INSERT INTO time_entries (id, started_at, ended_at, kind, focus, note, created_at) VALUES (?, ?, ?, 'manual', ?, ?, ?)",
    )
    .run(id, input.startIso, input.endIso, input.focus ? 1 : 0, input.note, ctx.clock.nowIso());
  return toEntry(
    ctx.db.prepare<[string], TimeRow>('SELECT * FROM time_entries WHERE id = ?').get(id) as TimeRow,
  );
}

/** Corrects a finished entry (e.g. a timer left running after the work stopped). */
export function updateTime(
  ctx: RepoContext,
  id: string,
  input: { startIso: string; endIso: string; focus: boolean; note: string },
): TimeEntryRecord {
  const row = ctx.db.prepare<[string], TimeRow>('SELECT * FROM time_entries WHERE id = ?').get(id);
  if (!row) throw notFound('Time entry', id);
  if (row.ended_at === null) throw new DomainError('CONFLICT', 'Stop the timer before editing it.');
  ctx.db
    .prepare(
      'UPDATE time_entries SET started_at = ?, ended_at = ?, focus = ?, note = ? WHERE id = ?',
    )
    .run(input.startIso, input.endIso, input.focus ? 1 : 0, input.note, id);
  return toEntry(
    ctx.db.prepare<[string], TimeRow>('SELECT * FROM time_entries WHERE id = ?').get(id) as TimeRow,
  );
}

export function deleteTime(ctx: RepoContext, id: string): void {
  if (ctx.db.prepare('DELETE FROM time_entries WHERE id = ?').run(id).changes === 0)
    throw notFound('Time entry', id);
}

// ── Devlog ──────────────────────────────────────────────────────────────────────

interface DevlogRow {
  id: string;
  date: string;
  title: string;
  body: string;
  tags: string;
}
const toDevlog = (r: DevlogRow): DevlogEntry => ({
  id: r.id,
  date: r.date,
  title: r.title,
  body: r.body,
  tags: r.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean),
});

export function listDevlog(ctx: RepoContext): DevlogEntry[] {
  return ctx.db
    .prepare<[], DevlogRow>(
      'SELECT id, date, title, body, tags FROM devlog_entries ORDER BY date DESC, created_at DESC',
    )
    .all()
    .map(toDevlog);
}

export function saveDevlog(
  ctx: RepoContext,
  input: { id?: string; date: string; title: string; body: string; tags: string[] },
): DevlogEntry {
  const now = ctx.clock.nowIso();
  const tags = [...new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].join(
    ',',
  );
  const id = input.id ?? newId();
  if (input.id) {
    const r = ctx.db
      .prepare(
        'UPDATE devlog_entries SET date = ?, title = ?, body = ?, tags = ?, updated_at = ? WHERE id = ?',
      )
      .run(input.date, input.title, input.body, tags, now, id);
    if (r.changes === 0) throw notFound('Devlog entry', id);
  } else {
    ctx.db
      .prepare(
        'INSERT INTO devlog_entries (id, date, title, body, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(id, input.date, input.title, input.body, tags, now, now);
  }
  return toDevlog(
    ctx.db
      .prepare<[string], DevlogRow>('SELECT * FROM devlog_entries WHERE id = ?')
      .get(id) as DevlogRow,
  );
}

export function deleteDevlog(ctx: RepoContext, id: string): void {
  if (ctx.db.prepare('DELETE FROM devlog_entries WHERE id = ?').run(id).changes === 0)
    throw notFound('Devlog entry', id);
}

// ── Steam checklist ─────────────────────────────────────────────────────────────

interface SteamRow {
  id: string;
  section: string;
  title: string;
  detail: string;
  done: number;
  sort_order: number;
}

export function listSteam(ctx: RepoContext): SteamItem[] {
  return ctx.db
    .prepare<[], SteamRow>('SELECT * FROM steam_checklist ORDER BY sort_order, created_at')
    .all()
    .map((r) => ({
      id: r.id,
      section: r.section,
      title: r.title,
      detail: r.detail,
      done: r.done === 1,
      sortOrder: r.sort_order,
    }));
}

export function setSteamDone(ctx: RepoContext, id: string, done: boolean): void {
  if (
    ctx.db.prepare('UPDATE steam_checklist SET done = ? WHERE id = ?').run(done ? 1 : 0, id)
      .changes === 0
  ) {
    throw notFound('Checklist item', id);
  }
}

export function saveSteamItem(
  ctx: RepoContext,
  input: { id?: string; section: string; title: string; detail: string },
): SteamItem {
  const id = input.id ?? newId();
  if (input.id) {
    const r = ctx.db
      .prepare('UPDATE steam_checklist SET section = ?, title = ?, detail = ? WHERE id = ?')
      .run(input.section, input.title, input.detail, id);
    if (r.changes === 0) throw notFound('Checklist item', id);
  } else {
    const order =
      ctx.db
        .prepare<[], { n: number | null }>('SELECT MAX(sort_order) + 1 AS n FROM steam_checklist')
        .get()?.n ?? 0;
    ctx.db
      .prepare(
        'INSERT INTO steam_checklist (id, section, title, detail, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(id, input.section, input.title, input.detail, order, ctx.clock.nowIso());
  }
  const item = listSteam(ctx).find((s) => s.id === id);
  if (!item) throw notFound('Checklist item', id);
  return item;
}

export function deleteSteamItem(ctx: RepoContext, id: string): void {
  if (ctx.db.prepare('DELETE FROM steam_checklist WHERE id = ?').run(id).changes === 0)
    throw notFound('Checklist item', id);
}
