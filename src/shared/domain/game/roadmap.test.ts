import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { availableTasks, blockersOf, rollup, wouldCreateCycle, type RoadmapTask } from './roadmap';

const task = (id: string, phaseId: string, o: Partial<RoadmapTask> = {}): RoadmapTask => ({
  id,
  phaseId,
  title: id,
  estimateHours: null,
  done: false,
  sortOrder: 0,
  ...o,
});

describe('roadmap dependencies', () => {
  const deps = [
    { taskId: 'b', dependsOnId: 'a' },
    { taskId: 'c', dependsOnId: 'b' },
  ];

  it('rejects self-dependencies and cycles, allows the rest', () => {
    expect(wouldCreateCycle(deps, 'a', 'a')).toBe(true);
    expect(wouldCreateCycle(deps, 'a', 'c')).toBe(true); // a → c → b → a
    expect(wouldCreateCycle(deps, 'a', 'b')).toBe(true);
    expect(wouldCreateCycle(deps, 'c', 'a')).toBe(false); // redundant but acyclic
    expect(wouldCreateCycle(deps, 'd', 'c')).toBe(false);
  });

  it('never accepts an edge that closes a loop (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 0, max: 7 }), fc.integer({ min: 0, max: 7 })), {
          maxLength: 40,
        }),
        (edges) => {
          const accepted: { taskId: string; dependsOnId: string }[] = [];
          for (const [a, b] of edges) {
            const edge = { taskId: `t${a}`, dependsOnId: `t${b}` };
            if (!wouldCreateCycle(accepted, edge.taskId, edge.dependsOnId)) accepted.push(edge);
          }
          // Topological sort must succeed.
          const nodes = new Set(accepted.flatMap((e) => [e.taskId, e.dependsOnId]));
          const indegree = new Map([...nodes].map((n) => [n, 0]));
          for (const e of accepted) indegree.set(e.taskId, (indegree.get(e.taskId) ?? 0) + 1);
          const queue = [...nodes].filter((n) => indegree.get(n) === 0);
          let visited = 0;
          while (queue.length) {
            const n = queue.pop() as string;
            visited++;
            for (const e of accepted.filter((x) => x.dependsOnId === n)) {
              indegree.set(e.taskId, (indegree.get(e.taskId) ?? 0) - 1);
              if (indegree.get(e.taskId) === 0) queue.push(e.taskId);
            }
          }
          expect(visited).toBe(nodes.size);
        },
      ),
    );
  });

  it('blocks a task until its prerequisites are done', () => {
    const tasks = [task('a', 'p'), task('b', 'p'), task('c', 'p')];
    expect(blockersOf('b', tasks, deps).map((t) => t.id)).toEqual(['a']);
    const done = tasks.map((t) => (t.id === 'a' ? { ...t, done: true } : t));
    expect(blockersOf('b', done, deps)).toEqual([]);
  });

  it('lists what can be worked on now, in roadmap order', () => {
    const phases = [
      { id: 'p1', title: 'One', sortOrder: 0 },
      { id: 'p2', title: 'Two', sortOrder: 1 },
    ];
    const tasks = [
      task('z', 'p2'),
      task('a', 'p1', { sortOrder: 1 }),
      task('b', 'p1', { sortOrder: 0 }),
      task('c', 'p1', { done: true }),
    ];
    expect(
      availableTasks(phases, tasks, [{ taskId: 'b', dependsOnId: 'a' }]).map((t) => t.id),
    ).toEqual(['a', 'z']);
  });
});

describe('progress rollup', () => {
  const phases = [
    { id: 'p1', title: 'One', sortOrder: 0 },
    { id: 'p2', title: 'Two', sortOrder: 1 },
  ];

  it('weights by estimate', () => {
    const tasks = [
      task('a', 'p1', { estimateHours: 9, done: true }),
      task('b', 'p1', { estimateHours: 1 }),
      task('c', 'p2', { estimateHours: 10 }),
    ];
    const r = rollup(phases, tasks);
    expect(r.phases.get('p1')?.progress).toBeCloseTo(0.9);
    expect(r.overall.progress).toBeCloseTo(0.45);
    expect(r.overall.remainingHours).toBe(11);
  });

  it('treats unestimated tasks as average-sized', () => {
    const tasks = [task('a', 'p1', { estimateHours: 4, done: true }), task('b', 'p1')];
    const r = rollup(phases, tasks);
    expect(r.phases.get('p1')?.progress).toBeCloseTo(0.5);
    expect(r.phases.get('p1')?.remainingHours).toBeNull();
  });

  it('counts tasks equally when nothing is estimated, and handles empty phases', () => {
    const tasks = [
      task('a', 'p1', { done: true }),
      task('b', 'p1'),
      task('c', 'p1'),
      task('d', 'p1'),
    ];
    const r = rollup(phases, tasks);
    expect(r.overall.progress).toBeCloseTo(0.25);
    expect(r.phases.get('p2')).toEqual({
      progress: 0,
      doneTasks: 0,
      totalTasks: 0,
      remainingHours: 0,
    });
  });
});
