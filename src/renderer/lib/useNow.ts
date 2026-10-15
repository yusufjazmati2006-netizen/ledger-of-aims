import { useEffect, useState } from 'react';
import { useApp } from '../stores/app';

/**
 * The current instant by the main-process clock, re-rendering every `intervalMs`
 * while `enabled`. Used for live displays such as a running timer.
 */
export function useNow(intervalMs: number, enabled = true): Date {
  const offset = useApp((s) => s.clockOffsetMs);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      setNow(Date.now());
    };
    const timer = setInterval(tick, intervalMs);
    return () => {
      clearInterval(timer);
    };
  }, [intervalMs, enabled]);
  return new Date(now + offset);
}
