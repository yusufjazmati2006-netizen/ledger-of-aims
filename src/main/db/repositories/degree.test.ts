import { describe, expect, it } from 'vitest';
import { createTestContext } from '../testing';
import {
  createAssessment,
  createModule,
  degreeData,
  deleteModule,
  listStudySessions,
  logStudy,
  updateAssessment,
  updateYear,
} from './degree';
import { createPlanBlock, listPlanBlocks, updatePlanBlock } from './plan';
import { DomainError } from '../../errors';

const base = {
  kind: 'coursework' as const,
  dueDate: null,
  status: 'not-started' as const,
  grade: null,
  notes: '',
};

describe('degree repository', () => {
  it('seeds three years at levels 4, 5 and 6', () => {
    const { years } = degreeData(createTestContext());
    expect(years.map((y) => [y.level, y.label])).toEqual([
      [4, 'Year 1 (Level 4)'],
      [5, 'Year 2 (Level 5)'],
      [6, 'Year 3 (Level 6)'],
    ]);
  });

  it('creates modules and assessments, keeping status consistent with grades', () => {
    const ctx = createTestContext();
    const year = degreeData(ctx).years[0]!;
    updateYear(ctx, year.id, { startDate: '2026-10-05' });
    const m = createModule(ctx, {
      yearId: year.id,
      code: 'BM4001',
      title: 'Principles of Management',
      credits: 20,
      notes: '',
    });
    const a = createAssessment(ctx, {
      ...base,
      moduleId: m.id,
      title: 'Essay',
      weight: 50,
      dueDate: '2026-12-04',
    });
    expect(a.status).toBe('not-started');
    expect(updateAssessment(ctx, a.id, { grade: 68 }).status).toBe('graded');
    expect(updateAssessment(ctx, a.id, { grade: null }).status).toBe('submitted');
    const data = degreeData(ctx);
    expect(data.years[0]?.startDate).toBe('2026-10-05');
    expect(data.assessments).toHaveLength(1);
    deleteModule(ctx, m.id);
    expect(degreeData(ctx).assessments).toHaveLength(0);
  });

  it('logs study time', () => {
    const ctx = createTestContext();
    logStudy(ctx, { date: '2026-10-15', minutes: 90, moduleId: null, note: 'Reading' });
    expect(listStudySessions(ctx, '2026-10-01', '2026-10-31')).toHaveLength(1);
  });

  it('stores plan blocks and rejects inverted ones', () => {
    const ctx = createTestContext();
    const b = createPlanBlock(ctx, {
      date: '2026-10-17',
      start: 600,
      end: 660,
      goalId: 'degree',
      kind: 'study',
      title: 'Study',
      pinned: true,
    });
    expect(updatePlanBlock(ctx, b.id, { done: true }).done).toBe(true);
    expect(() => updatePlanBlock(ctx, b.id, { end: 500 })).toThrow(DomainError);
    expect(listPlanBlocks(ctx, '2026-10-17', '2026-10-17')).toHaveLength(1);
  });
});
