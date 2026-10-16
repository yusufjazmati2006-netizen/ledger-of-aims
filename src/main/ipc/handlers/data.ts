import { randomUUID } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  app,
  dialog,
  shell,
  type BrowserWindow,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from 'electron';
import type { BackupFile } from '@shared/ipc/contract';
import type { BackupStatus, ExportFile } from '@shared/schemas/data';
import { DomainError } from '../../errors';
import type { RepoContext } from '../../db/repositories/context';
import { createBackup } from '../../services/backup';
import { isValidLedgerDatabase, listBackupFiles } from '../../services/backupFiles';
import { calendarExport } from '../../services/calendar';
import { exportData, previewImport, readExport } from '../../services/exchange';
import { search } from '../../services/search';
import type { PartialHandlerTable } from '../types';

export interface DataDeps {
  ctx: RepoContext;
  photosDir: string;
  backupDir: () => string;
  defaultBackupDir: string;
  setBackupDir: (dir: string | null) => void;
  lastBackupError: () => string | null;
  window: () => BrowserWindow | null;
  /** Closes the database, restores the file (after a snapshot) and reloads. */
  restore: (path: string) => void;
  /** Snapshots, replaces all data with the export and reloads. */
  importFile: (file: ExportFile) => void;
}

async function saveDialog(deps: DataDeps, options: SaveDialogOptions): Promise<string | null> {
  const win = deps.window();
  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options);
  return result.canceled || !result.filePath ? null : result.filePath;
}

async function openDialog(deps: DataDeps, options: OpenDialogOptions): Promise<string | null> {
  const win = deps.window();
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  return result.canceled ? null : (result.filePaths[0] ?? null);
}

export function dataHandlers(deps: DataDeps): PartialHandlerTable {
  const { ctx } = deps;
  /** Files chosen in an open dialog may be restored even if outside the backup folder. */
  const approved = new Set<string>();
  /** Parsed exports awaiting confirmation, by token. */
  const pending = new Map<string, ExportFile>();

  const status = (): BackupStatus => {
    const dir = deps.backupDir();
    const newest = listBackupFiles(dir)[0];
    return {
      directory: dir,
      isDefault: dir === deps.defaultBackupDir,
      lastBackupAt: newest?.createdAt ?? null,
      lastError: deps.lastBackupError(),
    };
  };

  return {
    'backups.status': () => status(),
    'backups.list': () => listBackupFiles(deps.backupDir()),
    'backups.create': () => {
      const path = createBackup({
        db: ctx.db,
        dir: deps.backupDir(),
        photosDir: deps.photosDir,
        label: 'manual',
        clock: ctx.clock,
      });
      const file = listBackupFiles(deps.backupDir()).find((b) => b.path === path);
      if (!file) throw new DomainError('UNAVAILABLE', 'The backup could not be written.');
      return file;
    },
    'backups.chooseFolder': async () => {
      const dir = await openDialog(deps, {
        title: 'Choose a folder for backups',
        defaultPath: deps.backupDir(),
        properties: ['openDirectory', 'createDirectory'],
      });
      if (!dir) return null;
      deps.setBackupDir(dir);
      return status();
    },
    'backups.useDefaultFolder': () => {
      deps.setBackupDir(null);
      return status();
    },
    'backups.reveal': async () => {
      await shell.openPath(deps.backupDir());
      return null;
    },
    'backups.chooseFile': async () => {
      const path = await openDialog(deps, {
        title: 'Restore from a backup file',
        defaultPath: deps.backupDir(),
        properties: ['openFile'],
        filters: [{ name: 'Ledger of Aims backup', extensions: ['sqlite'] }],
      });
      if (!path) return null;
      const valid = isValidLedgerDatabase(path);
      if (valid) approved.add(path);
      const file: BackupFile = {
        path,
        name: basename(path),
        label: 'other',
        createdAt: ctx.clock.nowIso(),
        sizeBytes: statSync(path).size,
        valid,
      };
      return file;
    },
    'backups.restore': ({ path }) => {
      const listed = listBackupFiles(deps.backupDir()).find((b) => b.path === path);
      const allowed =
        (listed?.valid ?? false) || (approved.has(path) && isValidLedgerDatabase(path));
      if (!allowed) throw new DomainError('NOT_FOUND', 'That backup is missing or not valid.');
      setImmediate(() => {
        deps.restore(path);
      });
      return null;
    },
    'data.export': async ({ includePhotos }) => {
      const path = await saveDialog(deps, {
        title: 'Export all data',
        defaultPath: join(
          app.getPath('documents'),
          `Ledger of Aims export ${ctx.clock.today()}.json`,
        ),
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!path) return null;
      const text = JSON.stringify(
        exportData(ctx, { appVersion: __APP_VERSION__, photosDir: deps.photosDir, includePhotos }),
      );
      writeFileSync(path, text);
      return { path, bytes: Buffer.byteLength(text) };
    },
    'data.importChoose': async () => {
      const path = await openDialog(deps, {
        title: 'Import a Ledger of Aims export',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!path) return null;
      const file = readExport(ctx, readFileSync(path, 'utf8'));
      const token = randomUUID();
      pending.clear();
      pending.set(token, file);
      return previewImport(ctx, file, { token, fileName: basename(path) });
    },
    'data.importApply': ({ token }) => {
      const file = pending.get(token);
      if (!file) throw new DomainError('NOT_FOUND', 'Choose the file to import again.');
      pending.delete(token);
      // Runs now so that a refusal (e.g. broken links) reaches the screen; the reload
      // that follows is deferred.
      deps.importFile(file);
      return null;
    },
    'calendar.export': async (options) => {
      const path = await saveDialog(deps, {
        title: 'Export to Calendar',
        defaultPath: join(app.getPath('documents'), 'Ledger of Aims.ics'),
        filters: [{ name: 'Calendar', extensions: ['ics'] }],
      });
      if (!path) return null;
      const { text, events } = calendarExport(ctx, options);
      writeFileSync(path, text);
      return { path, events };
    },
    'search.query': ({ q, limit }) => search(ctx, q, limit),
  };
}
