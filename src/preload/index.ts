import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { LedgerBridge } from '@shared/ipc/bridge';

/**
 * The renderer's only window onto the main process. It exposes a single generic
 * `invoke` (validated against the contract in main) and a subscription helper for
 * main → renderer events. No Node or Electron objects leak through.
 */
const bridge: LedgerBridge = {
  invoke: (channel, input) => ipcRenderer.invoke('ledger:invoke', channel, input),
  on: (event, listener) => {
    const wrapped = (_event: IpcRendererEvent, payload: unknown) => {
      listener(payload as Parameters<typeof listener>[0]);
    };
    ipcRenderer.on(`ledger:event:${event}`, wrapped);
    return () => {
      ipcRenderer.removeListener(`ledger:event:${event}`, wrapped);
    };
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld('ledger', bridge);
