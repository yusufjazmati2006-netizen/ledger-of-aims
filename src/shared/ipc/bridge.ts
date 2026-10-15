import type { Channel, EventName, EventPayloads, InputOf, IpcResult, OutputOf } from './contract';

/** The API the preload script exposes on `window.ledger`. */
export interface LedgerBridge {
  invoke<C extends Channel>(channel: C, input: InputOf<C>): Promise<IpcResult<OutputOf<C>>>;
  on<E extends EventName>(event: E, listener: (payload: EventPayloads[E]) => void): () => void;
  platform: string;
}
