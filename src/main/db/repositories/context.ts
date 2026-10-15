import { randomUUID } from 'node:crypto';
import type { Db } from '../connection';
import type { Clock } from '../../clock';

/** Everything a repository needs: the database handle and the (overridable) clock. */
export interface RepoContext {
  db: Db;
  clock: Clock;
}

export function newId(): string {
  return randomUUID();
}
