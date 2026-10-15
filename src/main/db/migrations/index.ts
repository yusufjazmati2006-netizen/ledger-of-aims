import type { Migration } from '../migrate';
import m001 from './001_core.sql?raw';
import m002 from './002_quran.sql?raw';

/**
 * Ordered list of schema migrations. Never edit a migration that has shipped;
 * add a new file instead. IDs must sort lexically in application order.
 */
export const migrations: readonly Migration[] = [
  { id: '001_core', sql: m001 },
  { id: '002_quran', sql: m002 },
];
