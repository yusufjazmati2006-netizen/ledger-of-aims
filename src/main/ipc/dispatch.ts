import { ZodError } from 'zod';
import {
  contract,
  isChannel,
  mutatedDomains,
  type DataDomain,
  type IpcResult,
} from '@shared/ipc/contract';
import { DomainError } from '../errors';
import type { PartialHandlerTable } from './types';

/**
 * Validates and dispatches one IPC call. Kept free of Electron imports so it can be
 * unit-tested directly; `register.ts` wires it to `ipcMain`.
 */
export async function dispatch(
  handlers: PartialHandlerTable,
  channel: unknown,
  rawInput: unknown,
  onMutated: (domains: readonly DataDomain[]) => void,
): Promise<IpcResult<unknown>> {
  if (!isChannel(channel)) {
    return {
      ok: false,
      error: { code: 'UNKNOWN_CHANNEL', message: `Unknown channel: ${String(channel)}` },
    };
  }
  const handler = handlers[channel] as ((input: unknown) => unknown) | undefined;
  if (!handler) {
    return {
      ok: false,
      error: {
        code: 'UNAVAILABLE',
        message: 'This action is unavailable while the database is offline.',
      },
    };
  }
  const parsed = contract[channel].input.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: validationError(parsed.error) };
  try {
    const data = await handler(parsed.data);
    const domains = mutatedDomains(channel);
    if (domains.length > 0) onMutated(domains);
    return { ok: true, data: data ?? null };
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    if (error instanceof ZodError) return { ok: false, error: validationError(error) };
    console.error(`[ipc] ${channel} failed`, error);
    return {
      ok: false,
      error: { code: 'INTERNAL', message: 'Something went wrong. The details have been logged.' },
    };
  }
}

function validationError(error: ZodError) {
  return {
    code: 'VALIDATION' as const,
    message: error.issues[0]?.message ?? 'Invalid input.',
    issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  };
}
