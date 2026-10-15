import type { RepoContext } from '../../db/repositories/context';
import {
  createAssessment,
  createModule,
  degreeData,
  deleteAssessment,
  deleteModule,
  deleteStudy,
  listStudySessions,
  logStudy,
  updateAssessment,
  updateModule,
  updateYear,
} from '../../db/repositories/degree';
import {
  createPlanBlock,
  deletePlanBlock,
  listPlanBlocks,
  updatePlanBlock,
} from '../../db/repositories/plan';
import type { PartialHandlerTable } from '../types';

export function degreeHandlers(ctx: RepoContext): PartialHandlerTable {
  return {
    'degree.data': () => degreeData(ctx),
    'degree.updateYear': ({ id, patch }) => updateYear(ctx, id, patch),
    'degree.createModule': (input) => createModule(ctx, input),
    'degree.updateModule': ({ id, patch }) => updateModule(ctx, id, patch),
    'degree.deleteModule': ({ id }) => {
      deleteModule(ctx, id);
      return null;
    },
    'degree.createAssessment': (input) => createAssessment(ctx, input),
    'degree.updateAssessment': ({ id, patch }) => updateAssessment(ctx, id, patch),
    'degree.deleteAssessment': ({ id }) => {
      deleteAssessment(ctx, id);
      return null;
    },
    'study.list': ({ from, to }) => listStudySessions(ctx, from, to),
    'study.log': (input) => logStudy(ctx, input),
    'study.delete': ({ id }) => {
      deleteStudy(ctx, id);
      return null;
    },
    'plan.list': ({ from, to }) => listPlanBlocks(ctx, from, to),
    'plan.create': (input) => createPlanBlock(ctx, input),
    'plan.update': ({ id, patch }) => updatePlanBlock(ctx, id, patch),
    'plan.delete': ({ id }) => {
      deletePlanBlock(ctx, id);
      return null;
    },
  };
}
