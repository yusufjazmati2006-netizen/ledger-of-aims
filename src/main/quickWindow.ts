import { app, BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import { loadRenderer, windowBackground } from './window';
import { sendTo } from './ipc/register';

const isMac = process.platform === 'darwin';
const WIDTH = 620;
const HEIGHT = 400;

/**
 * The quick-log window: a small floating palette summoned by the global shortcut or
 * the menu-bar item, from any app. It hides when it loses focus or after a log, and
 * is created once and reused so it appears instantly.
 */
export function createQuickLog(options: { mainVisible: () => boolean }) {
  let win: BrowserWindow | null = null;

  const ensure = (): BrowserWindow => {
    if (win && !win.isDestroyed()) return win;
    win = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
      show: false,
      frame: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      title: 'Quick log',
      transparent: isMac,
      vibrancy: isMac ? 'popover' : undefined,
      visualEffectState: 'active',
      roundedCorners: true,
      backgroundColor: windowBackground(),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
      },
    });
    if (isMac) win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setAlwaysOnTop(true, 'floating');
    win.on('blur', () => {
      // Not while tests drive it: an unfocused Xvfb window would vanish mid-test.
      if (!process.env.LEDGER_KEEP_QUICK_OPEN) hide();
    });
    // Keep the title (the page's own <title> would replace it).
    win.on('page-title-updated', (event) => {
      event.preventDefault();
    });
    win.on('closed', () => {
      win = null;
    });
    loadRenderer(win, '/quick');
    return win;
  };

  const hide = () => {
    if (!win || win.isDestroyed() || !win.isVisible()) return;
    win.hide();
    // Give focus back to the app you were in, unless our main window is in use.
    if (isMac && !options.mainVisible()) app.hide();
  };

  const show = () => {
    const w = ensure();
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const area = display.workArea;
    w.setPosition(
      Math.round(area.x + (area.width - WIDTH) / 2),
      Math.round(area.y + area.height * 0.22),
    );
    const reveal = () => {
      w.show();
      w.focus();
      sendTo(w, 'quick:shown', {});
    };
    if (w.webContents.isLoading()) w.webContents.once('did-finish-load', reveal);
    else reveal();
  };

  return {
    show,
    hide,
    toggle: () => {
      if (win && !win.isDestroyed() && win.isVisible() && win.isFocused()) hide();
      else show();
    },
    window: () => win,
    /** Created in the background at start-up so the first summon is instant. */
    preload: () => {
      ensure();
    },
  };
}

export type QuickLog = ReturnType<typeof createQuickLog>;
