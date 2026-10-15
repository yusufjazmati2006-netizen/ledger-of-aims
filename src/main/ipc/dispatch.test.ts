import { describe, expect, it, vi } from 'vitest';
import { dispatch } from './dispatch';
import { DomainError } from '../errors';
import type { PartialHandlerTable } from './types';

describe('IPC dispatch', () => {
  const handlers: PartialHandlerTable = {
    'weighIns.upsert': (input) => ({ id: 'w1', ...input }),
    'goals.list': () => [],
    'milestones.delete': () => {
      throw new DomainError('NOT_FOUND', 'Milestone not found (x).');
    },
    'milestones.list': () => {
      throw new Error('disk on fire');
    },
  };

  it('rejects unknown channels', async () => {
    const result = await dispatch(handlers, 'fs.deleteEverything', {}, vi.fn());
    expect(result).toMatchObject({ ok: false, error: { code: 'UNKNOWN_CHANNEL' } });
  });

  it('validates input before the handler runs', async () => {
    const onMutated = vi.fn();
    const result = await dispatch(
      handlers,
      'weighIns.upsert',
      { date: '2026-13-40', weightKg: 3 },
      onMutated,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION');
      expect(result.error.issues?.map((i) => i.path)).toEqual(['date', 'weightKg']);
    }
    expect(onMutated).not.toHaveBeenCalled();
  });

  it('applies schema defaults and reports mutated domains', async () => {
    const onMutated = vi.fn();
    const result = await dispatch(
      handlers,
      'weighIns.upsert',
      { date: '2026-10-15', weightKg: 66.4 },
      onMutated,
    );
    expect(result).toEqual({
      ok: true,
      data: { id: 'w1', date: '2026-10-15', weightKg: 66.4, note: '' },
    });
    expect(onMutated).toHaveBeenCalledWith(['weighIns']);
  });

  it('does not report reads as mutations', async () => {
    const onMutated = vi.fn();
    await dispatch(handlers, 'goals.list', undefined, onMutated);
    expect(onMutated).not.toHaveBeenCalled();
  });

  it('maps domain errors and hides internal ones', async () => {
    expect(await dispatch(handlers, 'milestones.delete', { id: 'x' }, vi.fn())).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Milestone not found (x).' },
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const internal = await dispatch(handlers, 'milestones.list', undefined, vi.fn());
    expect(internal).toMatchObject({ ok: false, error: { code: 'INTERNAL' } });
    expect(JSON.stringify(internal)).not.toContain('disk on fire');
    spy.mockRestore();
  });

  it('reports channels without a handler as unavailable (recovery mode)', async () => {
    expect(await dispatch({}, 'goals.list', undefined, vi.fn())).toMatchObject({
      ok: false,
      error: { code: 'UNAVAILABLE' },
    });
  });
});
