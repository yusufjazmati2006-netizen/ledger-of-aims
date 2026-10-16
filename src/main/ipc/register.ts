import { BrowserWindow, ipcMain } from 'electron';
import type { DataDomain, EventName, EventPayloads } from '@shared/ipc/contract';
import { dispatch } from './dispatch';
import type { PartialHandlerTable } from './types';

let currentHandlers: PartialHandlerTable = {};
let registered = false;
const listeners = new Set<(domains: DataDomain[]) => void>();

/** Main-process subscribers to data changes (e.g. the menu-bar item). */
export function onDataChanged(listener: (domains: DataDomain[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Installs (or swaps) the active handler table. Recovery mode uses a reduced table. */
export function setHandlers(handlers: PartialHandlerTable): void {
  currentHandlers = handlers;
  if (registered) return;
  registered = true;
  ipcMain.handle('ledger:invoke', (_event, channel: unknown, input: unknown) =>
    dispatch(currentHandlers, channel, input, (domains) => {
      const list = [...domains] as DataDomain[];
      broadcast('data:changed', { domains: list });
      for (const listener of listeners) listener(list);
    }),
  );
}

export function broadcast<E extends EventName>(event: E, payload: EventPayloads[E]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(`ledger:event:${event}`, payload);
  }
}

/** Sends an event to one window only. */
export function sendTo<E extends EventName>(
  win: BrowserWindow,
  event: E,
  payload: EventPayloads[E],
): void {
  if (!win.isDestroyed()) win.webContents.send(`ledger:event:${event}`, payload);
}
