import { BrowserWindow, nativeTheme, screen, shell } from 'electron';
import { join } from 'node:path';
import type { WindowSettings } from '@shared/schemas/settings';

const isMac = process.platform === 'darwin';

export interface CreateWindowOptions {
  saved: WindowSettings;
  hash?: string;
  onBoundsChange?: (state: WindowSettings) => void;
}

/** Light and dark window backgrounds, matched to the `--paper` design token. */
export function windowBackground(): string {
  if (isMac) return '#00000000';
  return nativeTheme.shouldUseDarkColors ? '#151513' : '#f6f3ed';
}

export function createMainWindow(options: CreateWindowOptions): BrowserWindow {
  const bounds = visibleBounds(options.saved.bounds);
  const win = new BrowserWindow({
    ...(bounds ?? { width: 1280, height: 840 }),
    minWidth: 940,
    minHeight: 620,
    show: false,
    title: 'Ledger of Aims',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 20, y: 22 },
    vibrancy: isMac ? 'sidebar' : undefined,
    visualEffectState: 'followWindow',
    backgroundColor: windowBackground(),
    autoHideMenuBar: !isMac,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      webSecurity: true,
    },
  });

  if (options.saved.maximized) win.maximize();
  win.once('ready-to-show', () => {
    win.show();
  });

  // The renderer is a single-page app: it never navigates and never opens windows.
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Links the user explicitly adds (resource links in notes) open in their own
    // browser. The app itself still makes no request.
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (options.onBoundsChange) {
    const report = () => {
      if (win.isDestroyed()) return;
      options.onBoundsChange?.({
        bounds: win.isMaximized() ? (options.saved.bounds ?? null) : win.getNormalBounds(),
        maximized: win.isMaximized(),
      });
    };
    let timer: NodeJS.Timeout | undefined;
    const debounced = () => {
      clearTimeout(timer);
      timer = setTimeout(report, 400);
    };
    win.on('resize', debounced);
    win.on('move', debounced);
    win.on('close', report);
  }

  loadRenderer(win, options.hash ?? '/');
  return win;
}

export function loadRenderer(win: BrowserWindow, hash: string): void {
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    void win.loadURL(`${devUrl}#${hash}`);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash });
  }
}

function isAppUrl(url: string): boolean {
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  return url.startsWith('file://') || (devUrl !== undefined && url.startsWith(devUrl));
}

/** Discards saved bounds that would place the window off every connected display. */
function visibleBounds(bounds: WindowSettings['bounds']): WindowSettings['bounds'] {
  if (!bounds) return null;
  const onScreen = screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return (
      bounds.x + 80 < a.x + a.width &&
      bounds.x + bounds.width - 80 > a.x &&
      bounds.y >= a.y - 10 &&
      bounds.y + 40 < a.y + a.height
    );
  });
  return onScreen ? bounds : null;
}
