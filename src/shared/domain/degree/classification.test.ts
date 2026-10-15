import { describe, expect, it } from 'vitest';
import {
  bandOf,
  DEFAULT_RULES,
  moduleMark,
  project,
  requiredMark,
  withWhatIf,
  type ClassificationModule,
} from './classification';

const mod = (
  id: string,
  level: 4 | 5 | 6,
  credits: number,
  assessments: [number, number | null][],
): ClassificationModule => ({
  id,
  level,
  credits,
  assessments: assessments.map(([weight, grade], i) => ({ id: `${id}-${i}`, weight, grade })),
});

/** A complete degree: six 20-credit modules per level. */
function fullDegree(l5: number, l6: number): ClassificationModule[] {
  return [
    ...Array.from({ length: 6 }, (_, i) => mod(`l4-${i}`, 4, 20, [[100, 30]])),
    ...Array.from({ length: 6 }, (_, i) => mod(`l5-${i}`, 5, 20, [[100, l5]])),
    ...Array.from({ length: 6 }, (_, i) => mod(`l6-${i}`, 6, 20, [[100, l6]])),
  ];
}

describe('classification', () => {
  it('bands marks with the standard boundaries', () => {
    const b = DEFAULT_RULES.boundaries;
    expect([75, 70, 69.9, 60, 55, 45, 39].map((m) => bandOf(m, b))).toEqual([
      'First',
      'First',
      '2:1',
      '2:1',
      '2:2',
      'Third',
      'Below third',
    ]);
  });

  it('computes a module mark from weighted assessments', () => {
    expect(
      moduleMark(
        mod('m', 5, 20, [
          [40, 65],
          [60, 75],
        ]),
      ),
    ).toEqual({ mark: 71, gradedWeight: 100, totalWeight: 100 });
    expect(
      moduleMark(
        mod('m', 5, 20, [
          [40, 65],
          [60, null],
        ]),
      ).mark,
    ).toBe(65);
    expect(moduleMark(mod('m', 5, 20, [[100, null]])).mark).toBeNull();
  });

  it('weights Level 5 and Level 6 one to two and ignores Level 4', () => {
    const p = project(fullDegree(60, 75), DEFAULT_RULES);
    expect(p.coverage).toBeCloseTo(1);
    expect(p.projected).toBeCloseTo((60 + 2 * 75) / 3); // 70
    expect(p.band).toBe('First');
  });

  it('honours other weightings, e.g. 25/75 or final year only', () => {
    const rules = { ...DEFAULT_RULES, levelWeights: { 4: 0, 5: 25, 6: 75 } as const };
    expect(project(fullDegree(60, 75), rules).projected).toBeCloseTo(71.25);
    const finalOnly = { ...DEFAULT_RULES, levelWeights: { 4: 0, 5: 0, 6: 1 } as const };
    expect(project(fullDegree(40, 75), finalOnly).projected).toBeCloseTo(75);
  });

  it('projects from graded work only while the degree is in progress', () => {
    const p = project(
      [
        mod('a', 5, 20, [
          [50, 68],
          [50, null],
        ]),
        mod('b', 5, 20, [[100, 72]]),
      ],
      DEFAULT_RULES,
    );
    expect(p.projected).toBeCloseTo((68 * 0.5 + 72) / 1.5);
    expect(p.coverage).toBeCloseTo((1 / 3) * (30 / 120));
  });

  it('reports nothing to project before any grade', () => {
    expect(project([], DEFAULT_RULES)).toMatchObject({ projected: null, band: null, coverage: 0 });
  });
});

describe('what do I need?', () => {
  it('solves the uniform mark needed on everything remaining', () => {
    // Level 5 fully graded at 60; Level 6 not started (120 credits expected).
    const modules = Array.from({ length: 6 }, (_, i) => mod(`l5-${i}`, 5, 20, [[100, 60]]));
    const first = requiredMark(modules, DEFAULT_RULES, 70);
    // 70 = (1/3)·60 + (2/3)·x → x = 75
    expect(first).toEqual({ status: 'achievable', mark: expect.closeTo(75, 6) as number });
    const upper = requiredMark(modules, DEFAULT_RULES, 60);
    expect(upper.status).toBe('achievable');
    if (upper.status === 'achievable') expect(upper.mark).toBeCloseTo(60);
  });

  it('says when a class is already secured', () => {
    const modules = Array.from({ length: 6 }, (_, i) => mod(`l5-${i}`, 5, 20, [[100, 95]]));
    // Third (40) needs (40 − 31.67)/(2/3) ≈ 12.5 — not yet secured, but with a 2:2 target…
    expect(
      requiredMark(modules, { ...DEFAULT_RULES, levelWeights: { 4: 0, 5: 1, 6: 0 } }, 70),
    ).toEqual({ status: 'secured' });
  });

  it('says when a class is out of reach', () => {
    const modules = Array.from({ length: 6 }, (_, i) => mod(`l5-${i}`, 5, 20, [[100, 5]]));
    const r = requiredMark(modules, DEFAULT_RULES, 70);
    // 70 = (1/3)·5 + (2/3)·x → x = 102.5
    expect(r.status).toBe('out-of-reach');
    if (r.status === 'out-of-reach') expect(r.mark).toBeCloseTo(102.5);
  });

  it('counts credits not yet entered as remaining work', () => {
    const one = [mod('a', 6, 20, [[100, 80]])];
    const rules = { ...DEFAULT_RULES, levelWeights: { 4: 0, 5: 0, 6: 1 } as const };
    const r = requiredMark(one, rules, 70);
    // 70 = (20/120)·80 + (100/120)·x → x = 68
    expect(r.status === 'achievable' && r.mark).toBeCloseTo(68);
  });

  it('agrees with the projection once every grade is known', () => {
    const modules = fullDegree(62, 71);
    const p = project(modules, DEFAULT_RULES).projected ?? 0;
    expect(requiredMark(modules, DEFAULT_RULES, p - 0.01).status).toBe('secured');
    expect(requiredMark(modules, DEFAULT_RULES, p + 0.01).status).toBe('out-of-reach');
  });

  it('explores what-if grades without touching real ones', () => {
    const modules = [
      mod('a', 6, 120, [
        [50, 60],
        [50, null],
      ]),
    ];
    const rules = { ...DEFAULT_RULES, levelWeights: { 4: 0, 5: 0, 6: 1 } as const };
    const whatIf = withWhatIf(
      modules,
      new Map([
        ['a-1', 80],
        ['a-0', 10],
      ]),
    );
    expect(whatIf[0]?.assessments.map((a) => a.grade)).toEqual([60, 80]);
    expect(project(whatIf, rules).projected).toBeCloseTo(70);
  });
});
