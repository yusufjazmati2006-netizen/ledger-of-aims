import type {
  Channel,
  DataDomain,
  ErrorCode,
  InputOf,
  IpcError,
  OutputOf,
} from '@shared/ipc/contract';

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly issues: IpcError['issues'];
  constructor(error: IpcError) {
    super(error.message);
    this.name = 'ApiError';
    this.code = error.code;
    this.issues = error.issues;
  }
}

type Args<C extends Channel> =
  undefined extends InputOf<C> ? [input?: InputOf<C>] : [input: InputOf<C>];

/** Calls a main-process channel and unwraps the result envelope, throwing ApiError on failure. */
export async function api<C extends Channel>(channel: C, ...args: Args<C>): Promise<OutputOf<C>> {
  const result = await window.ledger.invoke(channel, args[0] as InputOf<C>);
  if (!result.ok) throw new ApiError(result.error);
  return result.data;
}

export function onDataChanged(listener: (domains: DataDomain[]) => void): () => void {
  return window.ledger.on('data:changed', ({ domains }) => {
    listener(domains);
  });
}
