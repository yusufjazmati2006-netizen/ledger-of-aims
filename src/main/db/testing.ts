import { createClock } from '../clock';
import { openDatabase } from './connection';
import { migrate } from './migrate';
import { migrations } from './migrations';
import { seedDatabase } from './seed';
import type { RepoContext } from './repositories/context';

/** An in-memory, migrated and seeded database for repository tests. */
export function createTestContext(now = '2026-10-15T09:00:00'): RepoContext {
  const db = openDatabase(':memory:');
  const clock = createClock(now);
  migrate(db, migrations, { now: () => clock.nowIso() });
  seedDatabase({ db, clock });
  return { db, clock };
}
