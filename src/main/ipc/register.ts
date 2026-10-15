import { BrowserWindow, ipcMain } from 'electron';
import type { DataDomain, EventName, EventPayloads } from '@shared/ipc/contract';
import { dispatch } from './dispatch';
import type { PartialHandlerTable } from './types';

let currentHandlers: PartialHandlerTable = {};
let registered = false;

/** Installs (or swaps) the active handler table. Recovery mode uses a reduced table. */
export function setHandlers(handlers: PartialHandlerTable): void {
  currentHandlers = handlers;
  if (registered) return;
  registered = true;
  ipcMain.handle('ledger:invoke', (_event, channel: unknown, input: unknown) =>
    dispatch(currentHandlers, channel, input, (domains) => {
      broadcast('data:changed', { domains: [...domains] as DataDomain[] });
    }),
  );
}

export function broadcast<E extends EventName>(event: E, payload: EventPayloads[E]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(`ledger:event:${event}`, payload);
  }
}
