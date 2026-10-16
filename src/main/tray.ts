import { app, Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron';
import { join } from 'node:path';
import { formatElapsed, elapsedSeconds } from '@shared/domain/game/time';
import type { TimeEntryRecord } from '@shared/schemas/game';

const isMac = process.platform === 'darwin';

export interface TrayActions {
  quickLog: () => void;
  open: (path: string) => void;
  timer: () => TimeEntryRecord | null;
  startTimer: () => void;
  stopTimer: () => void;
  shortcut: () => string;
  now: () => Date;
}

function iconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'trayTemplate.png')
    : join(app.getAppPath(), 'build', 'trayTemplate.png');
}

/** Electron accelerators read better as macOS symbols in menus. */
export function shortcutLabel(accelerator: string): string {
  if (!accelerator) return '';
  if (!isMac) return accelerator.replace(/CommandOrControl|CmdOrCtrl/g, 'Ctrl');
  return accelerator
    .replace(/CommandOrControl|CmdOrCtrl|Command|Cmd/g, '⌘')
    .replace(/Control|Ctrl/g, '⌃')
    .replace(/Option|Alt/g, '⌥')
    .replace(/Shift/g, '⇧')
    .replace(/Space/g, 'Space')
    .replace(/\+/g, '');
}

/**
 * The menu-bar item: quick log, the game timer (its elapsed time shows beside the
 * icon while it runs), and shortcuts into the app. Refreshed on data changes.
 */
export function createTray(actions: TrayActions) {
  let tray: Tray | null = null;
  let ticker: NodeJS.Timeout | undefined;

  const refresh = () => {
    if (!tray || tray.isDestroyed()) return;
    const timer = actions.timer();
    const seconds = timer ? elapsedSeconds(timer.startedAt, actions.now()) : 0;
    const elapsed = timer ? formatElapsed(seconds) : '';
    const short = `${Math.floor(seconds / 3600)}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}`;
    if (isMac)
      tray.setTitle(timer ? ` ${short}` : '', {
        fontType: 'monospacedDigit',
      });
    tray.setToolTip(timer ? `Ledger of Aims — game timer ${elapsed}` : 'Ledger of Aims');
    const shortcut = actions.shortcut();
    const template: MenuItemConstructorOptions[] = [
      {
        label: 'Quick Log…',
        accelerator: shortcut || undefined,
        registerAccelerator: false,
        click: actions.quickLog,
      },
      timer
        ? {
            label: `Stop Game Timer (${short})`,
            click: actions.stopTimer,
          }
        : { label: 'Start Game Timer', click: actions.startTimer },
      { type: 'separator' },
      { label: 'Today', click: () => actions.open('/') },
      { label: 'Planner', click: () => actions.open('/planner') },
      { label: 'Weekly Review', click: () => actions.open('/review') },
      { type: 'separator' },
      { label: 'Open Ledger of Aims', click: () => actions.open('/') },
      { label: 'Quit Ledger of Aims', role: 'quit' },
    ];
    tray.setContextMenu(Menu.buildFromTemplate(template));
  };

  return {
    show: () => {
      if (tray && !tray.isDestroyed()) return;
      const image = nativeImage.createFromPath(iconPath());
      if (isMac) image.setTemplateImage(true);
      try {
        tray = new Tray(image);
      } catch (error) {
        // Some Linux desktops have no status area; the app works without it.
        console.warn('[tray] unavailable:', error);
        tray = null;
        return;
      }
      refresh();
      // Keep the elapsed time beside the icon current.
      ticker = setInterval(refresh, 30_000);
    },
    hide: () => {
      clearInterval(ticker);
      tray?.destroy();
      tray = null;
    },
    refresh,
    isShown: () => tray !== null && !tray.isDestroyed(),
  };
}

export type LedgerTray = ReturnType<typeof createTray>;
