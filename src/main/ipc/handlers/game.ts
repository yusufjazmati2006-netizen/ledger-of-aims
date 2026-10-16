import { addDays, localMidnight } from '@shared/domain/time/localDate';
import type { RepoContext } from '../../db/repositories/context';
import {
  addDecision,
  addDependency,
  addManualTime,
  deleteDecision,
  deleteDevlog,
  deleteLearningItem,
  deletePhase,
  deleteProject,
  deleteSteamItem,
  deleteTask,
  deleteTime,
  listDevlog,
  listLearning,
  listProjects,
  listSteam,
  listTime,
  removeDependency,
  roadmap,
  runningTimer,
  saveDevlog,
  saveLearningItem,
  savePhase,
  saveProject,
  saveSteamItem,
  saveTask,
  setSteamDone,
  setTaskDone,
  startTimer,
  stopTimer,
  updateTime,
} from '../../db/repositories/game';
import type { PartialHandlerTable } from '../types';

/** Local midnight of a calendar date, as an ISO instant. */
const localMidnightIso = (date: string) => localMidnight(date).toISOString();

export function gameHandlers(ctx: RepoContext): PartialHandlerTable {
  return {
    'game.roadmap': () => roadmap(ctx),
    'game.savePhase': (input) => savePhase(ctx, input),
    'game.deletePhase': ({ id }) => {
      deletePhase(ctx, id);
      return null;
    },
    'game.saveTask': (input) => saveTask(ctx, input),
    'game.setTaskDone': ({ id, done }) => setTaskDone(ctx, id, done),
    'game.deleteTask': ({ id }) => {
      deleteTask(ctx, id);
      return null;
    },
    'game.addDependency': (dep) => addDependency(ctx, dep),
    'game.removeDependency': (dep) => removeDependency(ctx, dep),
    'game.learning': () => listLearning(ctx),
    'game.saveLearningItem': (input) => saveLearningItem(ctx, input),
    'game.deleteLearningItem': ({ id }) => {
      deleteLearningItem(ctx, id);
      return null;
    },
    'game.addDecision': (input) => addDecision(ctx, input),
    'game.deleteDecision': ({ id }) => {
      deleteDecision(ctx, id);
      return null;
    },
    'game.projects': () => listProjects(ctx),
    'game.saveProject': (input) => saveProject(ctx, input),
    'game.deleteProject': ({ id }) => {
      deleteProject(ctx, id);
      return null;
    },
    'devlog.list': () => listDevlog(ctx),
    'devlog.save': (input) => saveDevlog(ctx, input),
    'devlog.delete': ({ id }) => {
      deleteDevlog(ctx, id);
      return null;
    },
    'steam.list': () => listSteam(ctx),
    'steam.setDone': ({ id, done }) => {
      setSteamDone(ctx, id, done);
      return null;
    },
    'steam.save': (input) => saveSteamItem(ctx, input),
    'steam.delete': ({ id }) => {
      deleteSteamItem(ctx, id);
      return null;
    },
    'time.list': ({ from, to }) =>
      listTime(ctx, localMidnightIso(from), localMidnightIso(addDays(to, 1))),
    'time.running': () => runningTimer(ctx),
    'time.start': ({ note }) => startTimer(ctx, note),
    'time.stop': (input) => stopTimer(ctx, input),
    'time.addManual': ({ date, start, minutes, focus, note }) =>
      addManualTime(ctx, { ...entrySpan(ctx, date, start, minutes), focus, note }),
    'time.update': ({ id, date, start, minutes, focus, note }) =>
      updateTime(ctx, id, { ...entrySpan(ctx, date, start, minutes), focus, note }),
    'time.delete': ({ id }) => {
      deleteTime(ctx, id);
      return null;
    },
  };
}

/**
 * A local date and optional HH:MM start plus a duration, as ISO instants. Without a
 * start, today's entry ends now (time just spent); an earlier day's sits at midday,
 * moved earlier if needed so it ends by midnight.
 */
function entrySpan(ctx: RepoContext, date: string, start: string | null, minutes: number) {
  const [y, m, d] = date.split('-').map(Number);
  let begin: Date;
  if (start !== null) {
    const [hh, mm] = start.split(':').map(Number);
    begin = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, hh ?? 12, mm ?? 0);
  } else if (date === ctx.clock.today()) {
    begin = new Date(ctx.clock.now().getTime() - minutes * 60_000);
  } else {
    const startMinute = Math.max(0, Math.min(12 * 60, 24 * 60 - minutes));
    begin = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 0, startMinute);
  }
  const end = new Date(begin.getTime() + minutes * 60_000);
  return { startIso: begin.toISOString(), endIso: end.toISOString() };
}
