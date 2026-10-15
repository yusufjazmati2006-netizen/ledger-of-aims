import type { Migration } from '../migrate';
import m001 from './001_core.sql?raw';
import m002 from './002_quran.sql?raw';
import m003 from './003_physique.sql?raw';
import m004 from './004_degree.sql?raw';
import m005 from './005_game.sql?raw';

/**
 * Ordered list of schema migrations. Never edit a migration that has shipped;
 * add a new file instead. IDs must sort lexically in application order.
 */
export const migrations: readonly Migration[] = [
  { id: '001_core', sql: m001 },
  { id: '002_quran', sql: m002 },
  { id: '003_physique', sql: m003 },
  { id: '004_degree', sql: m004 },
  { id: '005_game', sql: m005 },
];
