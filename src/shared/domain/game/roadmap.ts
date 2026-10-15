/**
 * Game roadmap: phases containing tasks, with "depends on" links between tasks.
 *
 * - A dependency may never create a cycle (checked before it is stored).
 * - A task is blocked while any task it depends on is unfinished.
 * - Progress rolls up by estimate: a 10-hour task counts ten times a 1-hour task.
 *   Tasks without an estimate count as the average of those with one (or 1 if none
 *   have estimates), so progress is meaningful before everything is estimated.
 */
export interface RoadmapTask {
  id: string;
  phaseId: string;
  title: string;
  estimateHours: number | null;
  done: boolean;
  sortOrder: number;
}

export interface RoadmapPhase {
  id: string;
  title: string;
  sortOrder: number;
}

export interface Dependency {
  taskId: string;
  dependsOnId: string;
}

/** True if adding "taskId depends on dependsOnId" would create a cycle. */
export function wouldCreateCycle(
  deps: readonly Dependency[],
  taskId: string,
  dependsOnId: string,
): boolean {
  if (taskId === dependsOnId) return true;
  // Is `taskId` already a (transitive) prerequisite of `dependsOnId`?
  const prerequisites = new Map<string, string[]>();
  for (const d of deps)
    prerequisites.set(d.taskId, [...(prerequisites.get(d.taskId) ?? []), d.dependsOnId]);
  const seen = new Set<string>();
  const stack = [dependsOnId];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === taskId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(prerequisites.get(current) ?? []));
  }
  return false;
}

export function blockersOf(
  taskId: string,
  tasks: readonly RoadmapTask[],
  deps: readonly Dependency[],
): RoadmapTask[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return deps
    .filter((d) => d.taskId === taskId)
    .map((d) => byId.get(d.dependsOnId))
    .filter((t): t is RoadmapTask => t !== undefined && !t.done);
}

export function isBlocked(
  taskId: string,
  tasks: readonly RoadmapTask[],
  deps: readonly Dependency[],
): boolean {
  return blockersOf(taskId, tasks, deps).length > 0;
}

function weights(tasks: readonly RoadmapTask[]): Map<string, number> {
  const known = tasks.map((t) => t.estimateHours).filter((e): e is number => e !== null && e > 0);
  const fallback = known.length > 0 ? known.reduce((s, e) => s + e, 0) / known.length : 1;
  return new Map(
    tasks.map((t) => [
      t.id,
      t.estimateHours !== null && t.estimateHours > 0 ? t.estimateHours : fallback,
    ]),
  );
}

export interface Rollup {
  progress: number;
  doneTasks: number;
  totalTasks: number;
  remainingHours: number | null;
}

function rollupOf(
  subset: readonly RoadmapTask[],
  w: Map<string, number>,
  allEstimated: boolean,
): Rollup {
  const total = subset.reduce((s, t) => s + (w.get(t.id) ?? 0), 0);
  const done = subset.filter((t) => t.done).reduce((s, t) => s + (w.get(t.id) ?? 0), 0);
  return {
    progress: total > 0 ? done / total : 0,
    doneTasks: subset.filter((t) => t.done).length,
    totalTasks: subset.length,
    remainingHours: allEstimated
      ? subset.filter((t) => !t.done).reduce((s, t) => s + (t.estimateHours ?? 0), 0)
      : null,
  };
}

/** Progress per phase and overall, weighted by estimates across the whole roadmap. */
export function rollup(
  phases: readonly RoadmapPhase[],
  tasks: readonly RoadmapTask[],
): { overall: Rollup; phases: Map<string, Rollup> } {
  const w = weights(tasks);
  const estimated = (subset: readonly RoadmapTask[]) =>
    subset.every((t) => t.estimateHours !== null);
  const byPhase = new Map<string, Rollup>();
  for (const p of phases) {
    const subset = tasks.filter((t) => t.phaseId === p.id);
    byPhase.set(p.id, rollupOf(subset, w, estimated(subset)));
  }
  return { overall: rollupOf(tasks, w, estimated(tasks)), phases: byPhase };
}

/** Unfinished, unblocked tasks in roadmap order — what can be worked on now. */
export function availableTasks<T extends RoadmapTask>(
  phases: readonly RoadmapPhase[],
  tasks: readonly T[],
  deps: readonly Dependency[],
): T[] {
  const phaseOrder = new Map(phases.map((p) => [p.id, p.sortOrder]));
  return tasks
    .filter((t) => !t.done && !isBlocked(t.id, tasks, deps))
    .sort(
      (a, b) =>
        (phaseOrder.get(a.phaseId) ?? 0) - (phaseOrder.get(b.phaseId) ?? 0) ||
        a.sortOrder - b.sortOrder,
    );
}
