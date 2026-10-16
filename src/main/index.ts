import {
  app,
  BrowserWindow,
  globalShortcut,
  nativeTheme,
  Notification,
  session,
  shell,
} from 'electron';
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
import { planningHandlers } from './ipc/handlers/planning';
import { checkPhysiqueMilestones } from './services/milestoneEngine';
import { handlePhotoProtocol, registerPhotoScheme } from './photo-protocol';
import { resolvePhotoFile } from './services/photos';
import { broadcast, onDataChanged, sendTo, setHandlers } from './ipc/register';
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
import { dirname } from 'node:path';
import type { ExportFile } from '@shared/schemas/data';
import { readBackupDirectory, writeBackupDirectory } from './services/backupConfig';
import { createBackup, needsDailyBackup, restorePhotos } from './services/backup';
import { applyImport } from './services/exchange';
import { invalidateSearch } from './services/search';
import { seedDatabase } from './db/seed';
import { dataHandlers } from './ipc/handlers/data';
import { createQuickLog } from './quickWindow';
import { createTray } from './tray';
import { startNotifier, type Notifier } from './services/notifier';
import { runningTimer, startTimer, stopTimer } from './db/repositories/game';

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
let notifier: Notifier | null = null;
let shortcutRegistered = false;
let registeredShortcut = '';

const quick = createQuickLog({
  mainVisible: () => Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()),
});

const tray = createTray({
  quickLog: () => {
    if (ctx) quick.show();
  },
  open: (path) => {
    openMain(path);
  },
  timer: () => (ctx ? runningTimer(ctx) : null),
  startTimer: () => {
    if (!ctx) return;
    startTimer(ctx, '');
    broadcast('data:changed', { domains: ['game'] });
    tray.refresh();
  },
  stopTimer: () => {
    if (!ctx) return;
    stopTimer(ctx, { note: '', focus: false });
    broadcast('data:changed', { domains: ['game'] });
    tray.refresh();
  },
  shortcut: () => (shortcutRegistered ? registeredShortcut : ''),
  now: () => clock.now(),
});

/** Shows the main window at `path`, navigating in place if it is already open. */
function openMain(path: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    sendTo(mainWindow, 'navigate', { path });
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  showWindow(ctx ? path : '/recovery');
}

/** Only the installed Mac app registers itself; a development build would add Electron. */
function loginItemSupported(): boolean {
  return process.platform === 'darwin' && app.isPackaged;
}

/** Registers the global quick-log shortcut; false if another app already holds it. */
function applySystemSettings(): void {
  if (!ctx) return;
  const system = getSettings(ctx, 'system');
  if (system.quickLogShortcut !== registeredShortcut || !shortcutRegistered) {
    if (registeredShortcut) globalShortcut.unregister(registeredShortcut);
    registeredShortcut = system.quickLogShortcut;
    shortcutRegistered = false;
    if (registeredShortcut) {
      try {
        shortcutRegistered = globalShortcut.register(registeredShortcut, () => {
          quick.toggle();
        });
      } catch (error) {
        console.warn('[shortcut] invalid accelerator:', registeredShortcut, error);
      }
    }
  }
  if (loginItemSupported()) app.setLoginItemSettings({ openAtLogin: system.openAtLogin });
  if (system.menuBar && !process.env.LEDGER_NO_TRAY) tray.show();
  else tray.hide();
  tray.refresh();
}

function systemHandlers(): PartialHandlerTable {
  return {
    'app.openMain': ({ path }) => {
      openMain(path);
      quick.hide();
      return null;
    },
    'quick.open': () => {
      quick.show();
      return null;
    },
    'quick.hide': () => {
      quick.hide();
      return null;
    },
    'system.status': () => ({
      shortcut: registeredShortcut,
      shortcutRegistered,
      menuBar: tray.isShown(),
      notificationsSupported: Notification.isSupported(),
      openAtLoginSupported: loginItemSupported(),
    }),
    'notifications.runNow': () => notifier?.tick() ?? [],
    'notifications.test': () => ({ supported: notifier?.test() ?? false }),
  };
}

function appInfo(): AppInfo {
  const paths = dataPaths();
  return {
    version: __APP_VERSION__,
    platform: process.platform,
    dataPath: paths.userData,
    dbPath: paths.db,
    isPackaged: app.isPackaged,
  };
}

/** The chosen backup folder, read from a file outside the database (see backupConfig). */
function backupDirectory(): string {
  const paths = dataPaths();
  return readBackupDirectory(paths.userData, paths.defaultBackups);
}

let lastBackupError: string | null = null;
let backupTimer: NodeJS.Timeout | undefined;

/** Makes today's backup if there is none yet; checked at start-up and every half hour. */
function runDailyBackup(): void {
  if (!ctx) return;
  try {
    const dir = backupDirectory();
    if (needsDailyBackup(listBackupFiles(dir), clock.now())) {
      createBackup({ db: ctx.db, dir, photosDir: dataPaths().photos, label: 'daily', clock });
      broadcast('data:changed', { domains: ['backups'] });
    }
    lastBackupError = null;
  } catch (error) {
    lastBackupError = error instanceof Error ? error.message : String(error);
    console.error('[backup] daily backup failed:', lastBackupError);
  }
}

/** Closes the database, swaps in the backup (after a snapshot) and reopens everything. */
function restoreFromBackup(path: string): void {
  if (!ctx) return;
  const paths = dataPaths();
  const dir = backupDirectory();
  createBackup({ db: ctx.db, dir, photosDir: paths.photos, label: 'pre-restore', clock });
  ctx.db.close();
  ctx = null;
  restoreDatabaseFile(path, paths.db);
  restorePhotos(dir, paths.photos);
  restorePhotos(dirname(path), paths.photos);
  invalidateSearch();
  reloadEverything();
}

/** Replaces all data with an export (after a snapshot), then reloads. */
function importExport(file: ExportFile): void {
  if (!ctx) return;
  const paths = dataPaths();
  createBackup({
    db: ctx.db,
    dir: backupDirectory(),
    photosDir: paths.photos,
    label: 'pre-import',
    clock,
  });
  applyImport(ctx, file, paths.photos);
  seedDatabase(ctx);
  invalidateSearch();
  reloadEverything();
}

function reloadEverything(): void {
  setImmediate(() => {
    const ok = ctx ? true : openData();
    showWindow(ok ? '/' : '/recovery');
    quick.window()?.reload();
  });
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
    ...planningHandlers(context),
    ...systemHandlers(),
    ...dataHandlers({
      ctx: context,
      photosDir: dataPaths().photos,
      backupDir: backupDirectory,
      defaultBackupDir: dataPaths().defaultBackups,
      setBackupDir: (dir) => {
        writeBackupDirectory(dataPaths().userData, dir);
        runDailyBackup();
      },
      lastBackupError: () => lastBackupError,
      window: () => mainWindow,
      restore: restoreFromBackup,
      importFile: importExport,
    }),
    'weighIns.upsert': (input) => {
      const result = core['weighIns.upsert']?.(input);
      for (const milestone of checkPhysiqueMilestones(context))
        broadcast('milestone:completed', { milestone });
      return result as ReturnType<NonNullable<(typeof core)['weighIns.upsert']>>;
    },
    'settings.update': (input) => {
      const result = core['settings.update']?.(input);
      applyTheme(getSettings(context, 'general').theme);
      applySystemSettings();
      return result as ReturnType<NonNullable<(typeof core)['settings.update']>>;
    },
  });
  applyTheme(getSettings(context, 'general').theme);
  applySystemSettings();
  invalidateSearch();
  runDailyBackup();
  clearInterval(backupTimer);
  backupTimer = setInterval(runDailyBackup, 30 * 60_000);
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
  buildAppMenu({
    dataPath: dataPaths().userData,
    devTools: !app.isPackaged,
    palette: () => {
      if (mainWindow && !mainWindow.isDestroyed()) sendTo(mainWindow, 'command', { id: 'palette' });
    },
    quickLog: () => {
      if (ctx) quick.show();
    },
  });
  showWindow(ok ? '/' : '/recovery');
  notifier = startNotifier(() => ctx, openMain);
  onDataChanged((domains) => {
    if (domains.includes('game')) tray.refresh();
    invalidateSearch();
  });
  // Create the quick-log window in the background once the main window has loaded.
  if (ok) setTimeout(quick.preload, 2500);

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
  clearInterval(backupTimer);
  globalShortcut.unregisterAll();
  notifier?.stop();
  tray.hide();
  ctx?.db.close();
  ctx = null;
});
