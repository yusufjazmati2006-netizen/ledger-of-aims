import { describe, expect, it } from 'vitest';
import { SEED_LEARNING, SEED_PRACTICE, SEED_ROADMAP, SEED_STEAM } from '@shared/seed/game';
import { createTestContext } from '../testing';
import {
  addDependency,
  listDevlog,
  listLearning,
  listProjects,
  listSteam,
  removeDependency,
  roadmap,
  runningTimer,
  saveDevlog,
  saveProject,
  saveTask,
  setTaskDone,
  startTimer,
  stopTimer,
  updateTime,
} from './game';
import { DomainError } from '../../errors';
import { createClock } from '../../clock';
import { isBlocked } from '@shared/domain/game/roadmap';

describe('game repository', () => {
  it('seeds a roadmap linked to the game milestones, with dependencies', () => {
    const ctx = createTestContext();
    const data = roadmap(ctx);
    expect(data.phases.map((p) => p.title)).toEqual(SEED_ROADMAP.map((p) => p.title));
    expect(data.phases.filter((p) => p.milestoneId !== null)).toHaveLength(5);
    expect(data.tasks).toHaveLength(SEED_ROADMAP.reduce((n, p) => n + p.tasks.length, 0));
    const tutorial = data.tasks.find((t) => t.title.startsWith('Finish the engine'))!;
    expect(isBlocked(tutorial.id, data.tasks, data.dependencies)).toBe(true);
    expect(listLearning(ctx).items).toHaveLength(SEED_LEARNING.length);
    expect(listProjects(ctx)).toHaveLength(SEED_PRACTICE.length);
    expect(listSteam(ctx)).toHaveLength(SEED_STEAM.length);
    expect(
      listSteam(ctx).every((s) => !s.detail.includes('US$') || s.detail.includes('Verify')),
    ).toBe(true);
  });

  it('refuses dependency loops and unblocks tasks when prerequisites finish', () => {
    const ctx = createTestContext();
    const data = roadmap(ctx);
    const engine = data.tasks.find((t) => t.title.startsWith('Choose an engine'))!;
    const tutorial = data.tasks.find((t) => t.title.startsWith('Finish the engine'))!;
    expect(() => addDependency(ctx, { taskId: engine.id, dependsOnId: tutorial.id })).toThrow(
      DomainError,
    );
    setTaskDone(ctx, engine.id, true);
    const after = roadmap(ctx);
    expect(isBlocked(tutorial.id, after.tasks, after.dependencies)).toBe(false);
    removeDependency(ctx, { taskId: tutorial.id, dependsOnId: engine.id });
    expect(roadmap(ctx).dependencies.some((d) => d.taskId === tutorial.id)).toBe(false);
  });

  it('adds tasks with estimates', () => {
    const ctx = createTestContext();
    const phase = roadmap(ctx).phases[0]!;
    const task = saveTask(ctx, {
      phaseId: phase.id,
      title: 'Read the docs on scenes',
      notes: '',
      estimateHours: 3,
    });
    expect(task.estimateHours).toBe(3);
  });

  it('runs one timer at a time, surviving as a stored row', () => {
    const ctx = createTestContext();
    startTimer(ctx, 'Pong paddle movement');
    expect(() => startTimer(ctx, 'again')).toThrow(DomainError);
    const later = { ...ctx, clock: createClock('2026-10-15T09:50:00') };
    expect(runningTimer(later)?.note).toBe('Pong paddle movement');
    const stopped = stopTimer(later, { note: '', focus: true });
    expect(stopped.focus).toBe(true);
    expect(
      new Date(stopped.endedAt!).getTime() - new Date(stopped.startedAt).getTime(),
    ).toBeGreaterThanOrEqual(49 * 60_000);
    expect(runningTimer(ctx)).toBeNull();
  });

  it('corrects finished entries but not the running timer', () => {
    const ctx = createTestContext();
    const running = startTimer(ctx, 'Forgot to stop');
    const span = { startIso: '2026-10-15T09:00:00.000Z', endIso: '2026-10-15T10:30:00.000Z' };
    expect(() => updateTime(ctx, running.id, { ...span, focus: false, note: '' })).toThrow(
      'Stop the timer',
    );
    stopTimer(ctx, { note: '', focus: false });
    const fixed = updateTime(ctx, running.id, { ...span, focus: true, note: 'Tilemap' });
    expect(fixed).toMatchObject({
      startedAt: span.startIso,
      endedAt: span.endIso,
      focus: true,
      note: 'Tilemap',
    });
    expect(() => updateTime(ctx, 'missing', { ...span, focus: false, note: '' })).toThrow(
      DomainError,
    );
  });

  it('stamps practice project dates as they move', () => {
    const ctx = createTestContext();
    const pong = listProjects(ctx)[0]!;
    const active = saveProject(ctx, { ...pong, status: 'active' });
    expect(active.startedOn).toBe('2026-10-15');
    const done = saveProject(ctx, { ...active, status: 'done', lessons: 'Keep scope tiny.' });
    expect(done.finishedOn).toBe('2026-10-15');
  });

  it('normalises devlog tags', () => {
    const ctx = createTestContext();
    saveDevlog(ctx, {
      date: '2026-10-15',
      title: 'Day one',
      body: '# Hello',
      tags: ['Godot', 'godot', ' learning '],
    });
    expect(listDevlog(ctx)[0]?.tags).toEqual(['godot', 'learning']);
  });
});
