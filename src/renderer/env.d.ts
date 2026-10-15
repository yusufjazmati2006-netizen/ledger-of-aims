/// <reference types="vite/client" />
import type { LedgerBridge } from '@shared/ipc/bridge';

declare global {
  interface Window {
    ledger: LedgerBridge;
  }
}

export {};
