import { useCallback, useEffect, useRef, useState } from 'react';
import type { Channel, DataDomain, InputOf, OutputOf } from '@shared/ipc/contract';
import { api, onDataChanged } from './api';

/**
 * A small stale-while-revalidate cache over IPC. Results are cached by channel and
 * input so revisiting a screen renders instantly, and every query refreshes itself
 * when the main process reports a change in one of its `domains` (or in any domain
 * when none are given). Local IPC is sub-millisecond, so this stays simple.
 */
const cache = new Map<string, unknown>();

export interface LedgerQuery<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

interface QueryState<T> {
  key: string;
  data: T | undefined;
  error: Error | null;
  loading: boolean;
}

export function useLedger<C extends Channel>(
  channel: C,
  input: InputOf<C>,
  options: { domains?: readonly DataDomain[]; enabled?: boolean } = {},
): LedgerQuery<OutputOf<C>> {
  // Inputs are plain JSON (they cross the IPC boundary), so their serialisation is
  // a faithful identity for caching and dependency tracking.
  const inputJson = input === undefined ? undefined : JSON.stringify(input);
  const key = `${channel}:${inputJson ?? ''}`;
  const domainsKey = options.domains ? options.domains.join(',') : '*';
  const enabled = options.enabled ?? true;

  const initial = (k: string): QueryState<OutputOf<C>> => ({
    key: k,
    data: cache.get(k) as OutputOf<C> | undefined,
    error: null,
    loading: !cache.has(k),
  });
  const [state, setState] = useState<QueryState<OutputOf<C>>>(() => initial(key));
  // Reset synchronously when the query identity changes (React's sanctioned
  // "adjust state during render" pattern), showing any cached value immediately.
  if (state.key !== key) setState(initial(key));

  const requestId = useRef(0);
  const load = useCallback(() => {
    const id = ++requestId.current;
    const parsedInput = (inputJson === undefined ? undefined : JSON.parse(inputJson)) as InputOf<C>;
    (api as (c: C, i: InputOf<C>) => Promise<OutputOf<C>>)(channel, parsedInput).then(
      (result) => {
        if (id !== requestId.current) return;
        cache.set(key, result);
        setState({ key, data: result, error: null, loading: false });
      },
      (err: unknown) => {
        if (id !== requestId.current) return;
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err : new Error(String(err)),
          loading: false,
        }));
      },
    );
  }, [channel, key, inputJson]);

  useEffect(() => {
    if (!enabled) return;
    load();
    const watch = domainsKey === '*' ? null : domainsKey.split(',');
    return onDataChanged((changed) => {
      if (!watch || changed.some((d) => watch.includes(d))) load();
    });
  }, [load, enabled, domainsKey]);

  return { data: state.data, error: state.error, loading: state.loading, reload: load };
}

export function clearLedgerCache(): void {
  cache.clear();
}
