import { app, BrowserWindow, nativeTheme, session, shell } from 'electron';
import type { AppInfo, RecoveryInfo } from '@shared/ipc/contract';
import type { GeneralSettings } from '@shared/schemas/settings';
import { createClock } from './clock';
import { DomainError } from './errors';
import type { RepoContext } from './db/repositories/context';
import { getAllSettings, getSettings, updateSettings } from './db/repositories/settings';
import { coreHandlers } from './ipc/handlers/core';
import { quranHandlers } from './ipc/handlers/quran';
import { physiqueHandlers } from './ipc/handlers/physique';
import { degreeHandlers } from './ipc/handlers/degree';
import { gameHandlers } from './ipc/handlers/game';
import { checkPhysiqueMilestones } from './services/milestoneEngine';
import { handlePhotoProtocol, registerPhotoScheme } from './photo-protocol';
import { resolvePhotoFile } from './services/photos';
import { broadcast, setHandlers } from './ipc/register';
import type { PartialHandlerTable } from './ipc/types';
import { buildAppMenu } from './menu';
import { installNetworkGuard, type NetworkGuard } from './network-guard';
import { configureUserDataPath, dataPaths } from './paths';
import {
  openLedgerDatabase,
  quarantineDatabase,
  recoveryInfo,
  restoreDatabaseFile,
} from './services/database';
import { listBackupFiles } from './services/backupFiles';
import { createMainWindow, loadRenderer } from './window';

// ── Before `ready` ───────────────────────────────────────────────────────────────
app.setName('Ledger of Aims');
configureUserDataPath();
// Belt and braces for the offline guarantee: Chromium's own background services
// are switched off, and the network guard cancels anything that slips through.
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-domain-reliability');

registerPhotoScheme();

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

const clock = createClock(process.env.LEDGER_NOW);
let ctx: RepoContext | null = null;
let mainWindow: BrowserWindow | null = null;
let guard: NetworkGuard | null = null;
let recovery: RecoveryInfo | null = null;

function appInfo(): AppInfo {
  const paths = dataPaths();
  return {
    version: app.getVersion(),
    platform: process.platform,
    dataPath: paths.userData,
    dbPath: paths.db,
    isPackaged: app.isPackaged,
  };
}

function backupDirectory(): string {
  return dataPaths().defaultBackups;
}

function applyTheme(theme: GeneralSettings['theme']): void {
  // Driving nativeTheme (rather than a CSS class) also updates vibrancy, the title
  // bar and `prefers-color-scheme` inside the renderer in one move.
  nativeTheme.themeSource = theme;
}

function baseHandlers(): PartialHandlerTable {
  return {
    'app.bootstrap': () => {
      if (ctx) {
        return {
          mode: 'normal',
          today: clock.today(),
          nowIso: clock.nowIso(),
          info: appInfo(),
          settings: getAllSettings(ctx),
        };
      }
      if (!recovery) throw new DomainError('UNAVAILABLE', 'The database is not open.');
      return { mode: 'recovery', info: appInfo(), recovery };
    },
    'app.today': () => ({ today: clock.today(), nowIso: clock.nowIso() }),
    'app.revealDataFolder': async () => {
      await shell.openPath(dataPaths().userData);
      return null;
    },
    'diagnostics.networkLog': () => ({ blocked: guard?.blocked() ?? [] }),
    'recovery.restore': ({ path }) => {
      if (ctx) throw new DomainError('CONFLICT', 'The database is open; use the backup screen.');
      // Only files the recovery screen listed (and validated) may be restored.
      const candidate = listBackupFiles(backupDirectory()).find((b) => b.path === path);
      if (!candidate?.valid)
        throw new DomainError('NOT_FOUND', 'That backup is missing or invalid.');
      const paths = dataPaths();
      quarantineDatabase(paths.db, paths.quarantine, clock);
      restoreDatabaseFile(candidate.path, paths.db);
      rebootIntoApp();
      return null;
    },
    'recovery.startFresh': () => {
      if (ctx) throw new DomainError('CONFLICT', 'The database is already open.');
      const paths = dataPaths();
      quarantineDatabase(paths.db, paths.quarantine, clock);
      rebootIntoApp();
      return null;
    },
    'recovery.quit': () => {
      setImmediate(() => {
        app.quit();
      });
      return null;
    },
  };
}

/** Opens the database; returns false (and enters recovery mode) if it cannot. */
function openData(): boolean {
  const outcome = openLedgerDatabase({
    dbPath: dataPaths().db,
    clock,
    backupDir: backupDirectory(),
  });
  if (!outcome.ok) {
    ctx = null;
    recovery = recoveryInfo(outcome.recovery, backupDirectory());
    console.error(
      `[db] entering recovery mode: ${outcome.recovery.reason}: ${outcome.recovery.detail}`,
    );
    setHandlers(baseHandlers());
    return false;
  }
  recovery = null;
  const context: RepoContext = { db: outcome.db, clock };
  ctx = context;
  if (outcome.applied.length > 0)
    console.info(`[db] applied migrations: ${outcome.applied.join(', ')}`);
  const core = coreHandlers(context);
  setHandlers({
    ...baseHandlers(),
    ...core,
    ...quranHandlers(context, broadcast),
    ...physiqueHandlers(context, { photosDir: dataPaths().photos, window: () => mainWindow }),
    ...degreeHandlers(context),
    ...gameHandlers(context),
    'weighIns.upsert': (input) => {
      const result = core['weighIns.upsert']?.(input);
      for (const milestone of checkPhysiqueMilestones(context))
        broadcast('milestone:completed', { milestone });
      return result as ReturnType<NonNullable<(typeof core)['weighIns.upsert']>>;
    },
    'settings.update': (input) => {
      const result = core['settings.update']?.(input);
      applyTheme(getSettings(context, 'general').theme);
      return result as ReturnType<NonNullable<(typeof core)['settings.update']>>;
    },
  });
  applyTheme(getSettings(context, 'general').theme);
  return true;
}

function showWindow(hash: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    loadRenderer(mainWindow, hash);
    mainWindow.show();
    return;
  }
  const saved = ctx ? getSettings(ctx, 'window') : { bounds: null, maximized: false };
  mainWindow = createMainWindow({
    saved,
    hash,
    onBoundsChange: (state) => {
      if (ctx) updateSettings(ctx, 'window', state);
    },
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function rebootIntoApp(): void {
  setImmediate(() => {
    const ok = openData();
    showWindow(ok ? '/' : '/recovery');
  });
}

void app.whenReady().then(() => {
  guard = installNetworkGuard(session.defaultSession, process.env.ELECTRON_RENDERER_URL);
  handlePhotoProtocol((id, variant) =>
    ctx ? resolvePhotoFile(ctx, dataPaths().photos, id, variant) : null,
  );
  const ok = openData();
  buildAppMenu({ dataPath: dataPaths().userData, devTools: !app.isPackaged });
  showWindow(ok ? '/' : '/recovery');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) showWindow(ctx ? '/' : '/recovery');
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  ctx?.db.close();
  ctx = null;
});
