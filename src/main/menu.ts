import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { NAV_ITEMS, SETTINGS_PATH } from '@shared/nav';
import { broadcast } from './ipc/register';

const isMac = process.platform === 'darwin';

/** The standard macOS menu bar, with ⌘1–⌘9 jumping between sections. */
export function buildAppMenu(options: {
  dataPath: string;
  devTools: boolean;
  palette: () => void;
  quickLog: () => void;
}): void {
  const navigate = (path: string) => () => {
    broadcast('navigate', { path });
  };

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { label: 'Settings…', accelerator: 'Cmd+,', click: navigate(SETTINGS_PATH) },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: 'File',
      submenu: [
        ...(isMac
          ? []
          : ([
              { label: 'Settings', accelerator: 'Ctrl+,', click: navigate(SETTINGS_PATH) },
              { type: 'separator' },
            ] satisfies MenuItemConstructorOptions[])),
        {
          label: 'Reveal Data Folder',
          click: () => void shell.openPath(options.dataPath),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'Go',
      submenu: [
        { label: 'Command Palette…', accelerator: 'CmdOrCtrl+K', click: options.palette },
        { label: 'Quick Log…', click: options.quickLog },
        { type: 'separator' },
        ...NAV_ITEMS.map((item, index) => ({
          label: item.label,
          accelerator: index < 9 ? `CmdOrCtrl+${index + 1}` : undefined,
          click: navigate(item.path),
        })),
      ],
    },
    {
      label: 'View',
      submenu: [
        ...(options.devTools
          ? ([
              { role: 'reload' },
              { role: 'toggleDevTools' },
              { type: 'separator' },
            ] satisfies MenuItemConstructorOptions[])
          : []),
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
