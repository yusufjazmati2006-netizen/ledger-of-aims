import { app } from 'electron';
import { join } from 'node:path';

/**
 * Resolves where Ledger of Aims keeps its data. On macOS this is
 * ~/Library/Application Support/LedgerOfAims. Tests point LEDGER_USER_DATA (and
 * LEDGER_BACKUP_DIR) at temporary folders so they never touch real data.
 */
export function configureUserDataPath(): string {
  const dir = process.env.LEDGER_USER_DATA ?? join(app.getPath('appData'), 'LedgerOfAims');
  app.setPath('userData', dir);
  return dir;
}

export function dataPaths() {
  const userData = app.getPath('userData');
  return {
    userData,
    db: join(userData, 'ledger.sqlite'),
    photos: join(userData, 'photos'),
    quarantine: join(userData, 'quarantine'),
    defaultBackups:
      process.env.LEDGER_BACKUP_DIR ?? join(app.getPath('documents'), 'LedgerOfAims Backups'),
  };
}
