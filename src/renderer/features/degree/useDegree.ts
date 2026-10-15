import { useMemo } from 'react';
import {
  project,
  requiredMark,
  type ClassificationModule,
  type ClassificationRules,
  type Level,
  type Projection,
  type Requirement,
} from '@shared/domain/degree/classification';
import type { Assessment, DegreeData, DegreeModule } from '@shared/schemas/degree';
import { useSettings } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';

export interface DegreeView {
  ready: boolean;
  data: DegreeData;
  rules: ClassificationRules;
  modules: ClassificationModule[];
  projection: Projection;
  requirements: { label: string; target: number; requirement: Requirement }[];
  levelOf: (m: DegreeModule) => Level;
  deadlines: (Assessment & { module: DegreeModule | undefined })[];
}

export const EMPTY: DegreeData = { years: [], modules: [], assessments: [] };

/** Turns stored modules and assessments into the classification model. */
export function toClassification(data: DegreeData): ClassificationModule[] {
  const levelOfYear = new Map(data.years.map((y) => [y.id, y.level]));
  return data.modules.map((m) => ({
    id: m.id,
    level: levelOfYear.get(m.yearId) ?? 4,
    credits: m.credits,
    assessments: data.assessments
      .filter((a) => a.moduleId === m.id)
      .map((a) => ({ id: a.id, weight: a.weight, grade: a.grade })),
  }));
}

export function useDegree(): DegreeView {
  const settings = useSettings();
  const query = useLedger('degree.data', undefined, { domains: ['degree'] });
  return useMemo(() => {
    const data = query.data ?? EMPTY;
    const d = settings.degree;
    const rules: ClassificationRules = {
      levelWeights: { 4: d.levelWeights[4], 5: d.levelWeights[5], 6: d.levelWeights[6] },
      boundaries: d.boundaries,
      creditsPerLevel: d.creditsPerLevel,
    };
    const modules = toClassification(data);
    const levelOfYear = new Map(data.years.map((y) => [y.id, y.level]));
    const byModule = new Map(data.modules.map((m) => [m.id, m]));
    return {
      ready: query.data !== undefined,
      data,
      rules,
      modules,
      projection: project(modules, rules),
      requirements: [
        { label: 'First', target: rules.boundaries.first },
        { label: '2:1', target: rules.boundaries.upperSecond },
        { label: '2:2', target: rules.boundaries.lowerSecond },
      ].map((r) => ({ ...r, requirement: requiredMark(modules, rules, r.target) })),
      levelOf: (m) => levelOfYear.get(m.yearId) ?? 4,
      deadlines: data.assessments
        .filter((a) => a.dueDate !== null)
        .map((a) => ({ ...a, module: byModule.get(a.moduleId) }))
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
    };
  }, [query.data, settings.degree]);
}

export const isDone = (a: Assessment) => a.status === 'submitted' || a.status === 'graded';
