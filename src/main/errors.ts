import type { ErrorCode } from '@shared/ipc/contract';

/** An expected failure that is reported to the renderer with a meaningful message. */
export class DomainError extends Error {
  constructor(
    readonly code: Exclude<ErrorCode, 'VALIDATION' | 'UNKNOWN_CHANNEL' | 'INTERNAL'>,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export function notFound(what: string, id: string): DomainError {
  return new DomainError('NOT_FOUND', `${what} not found (${id}).`);
}
